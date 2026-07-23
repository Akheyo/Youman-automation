import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DocumentTemplateInfo, DocumentType } from "@youman/shared";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { convertDocxToPdf, extractTemplateStructure, renderDocx } from "./docx-engine";
import { appendAgb } from "./pdf-appendix";
import { TemplateParseError } from "./errors";

const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;

interface TemplateRow {
  id: string;
  tenantId: string;
  name: string;
  documentType: string;
  fileName: string;
  placeholders: unknown;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toInfo(row: TemplateRow): DocumentTemplateInfo {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    documentType: row.documentType as DocumentType,
    fileName: row.fileName,
    placeholders: Array.isArray(row.placeholders) ? (row.placeholders as string[]) : [],
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(tenantId: string): Promise<DocumentTemplateInfo[]> {
    const rows = await this.prisma.documentTemplate.findMany({
      where: { tenantId },
      orderBy: [{ documentType: "asc" }, { isDefault: "desc" }, { name: "asc" }],
      select: TEMPLATE_INFO_SELECT,
    });
    return rows.map(toInfo);
  }

  async upload(
    tenantId: string,
    userId: string,
    params: { name: string; documentType: DocumentType; fileName: string; fileData: Buffer }
  ): Promise<DocumentTemplateInfo> {
    if (params.fileData.length === 0) {
      throw new TemplateParseError("Die hochgeladene Datei ist leer.");
    }
    if (params.fileData.length > MAX_TEMPLATE_BYTES) {
      throw new TemplateParseError("Die Vorlage ist größer als 10 MB. Bitte Bilder in der Word-Datei komprimieren.");
    }
    // Throws TemplateParseError on broken/non-DOCX files.
    const structure = extractTemplateStructure(params.fileData);

    const created = await this.prisma.$transaction(async (tx) => {
      // First template of its type automatically becomes the default.
      const existing = await tx.documentTemplate.count({
        where: { tenantId, documentType: params.documentType },
      });
      return tx.documentTemplate.create({
        data: {
          tenantId,
          name: params.name,
          documentType: params.documentType,
          fileName: params.fileName,
          fileData: params.fileData,
          placeholders: structure.placeholders,
          isDefault: existing === 0,
        },
        select: TEMPLATE_INFO_SELECT,
      });
    });

    void this.audit.log({
      tenantId,
      userId,
      eventType: "template.uploaded",
      resourceType: "document_template",
      resourceId: created.id,
      description: `Dokumentvorlage '${params.name}' (${params.documentType}) hochgeladen`,
      metadata: { placeholders: structure.placeholders },
    });
    return toInfo(created);
  }

  async rename(tenantId: string, id: string, name: string): Promise<DocumentTemplateInfo> {
    await this.getOwned(tenantId, id);
    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: { name },
      select: TEMPLATE_INFO_SELECT,
    });
    return toInfo(updated);
  }

  async setDefault(tenantId: string, id: string): Promise<DocumentTemplateInfo> {
    const target = await this.getOwned(tenantId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.documentTemplate.updateMany({
        where: { tenantId, documentType: target.documentType as DocumentType, isDefault: true },
        data: { isDefault: false },
      });
      return tx.documentTemplate.update({
        where: { id },
        data: { isDefault: true },
        select: TEMPLATE_INFO_SELECT,
      });
    });
    return toInfo(updated);
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    const target = await this.getOwned(tenantId, id);
    await this.prisma.documentTemplate.delete({ where: { id } });
    void this.audit.log({
      tenantId,
      userId,
      eventType: "template.deleted",
      resourceType: "document_template",
      resourceId: id,
      description: `Dokumentvorlage '${target.name}' gelöscht`,
    });
  }

  async findDefault(tenantId: string, documentType: DocumentType): Promise<DocumentTemplateInfo | null> {
    const row = await this.prisma.documentTemplate.findFirst({
      where: { tenantId, documentType, isDefault: true },
      select: TEMPLATE_INFO_SELECT,
    });
    return row ? toInfo(row) : null;
  }

  /**
   * Renders the template with the given data. Throws MissingFieldsError (→ 422)
   * when placeholders are uncovered, RenderError when filling/PDF conversion fails.
   */
  async render(
    tenantId: string,
    userId: string,
    id: string,
    data: Record<string, unknown>,
    format: "docx" | "pdf"
  ): Promise<{ content: Buffer; fileName: string; contentType: string }> {
    const row = await this.prisma.documentTemplate.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Vorlage nicht gefunden");

    const docx = renderDocx(Buffer.from(row.fileData), data);
    const baseName = row.fileName.replace(/\.docx$/i, "");

    void this.audit.log({
      tenantId,
      userId,
      eventType: "document.rendered",
      resourceType: "document_template",
      resourceId: row.id,
      description: `Dokument aus Vorlage '${row.name}' gerendert (${format.toUpperCase()})`,
      metadata: { format, documentType: row.documentType },
    });

    if (format === "pdf") {
      let pdf = await convertDocxToPdf(docx);
      // Angebote bekommen die festen AGB-Seiten 1:1 ans PDF gehängt
      // (best-effort – ein AGB-Problem verhindert nie das Angebot).
      if (row.documentType === "OFFER") {
        pdf = await appendAgb(pdf);
      }
      return { content: pdf, fileName: `${baseName}.pdf`, contentType: "application/pdf" };
    }
    return {
      content: docx,
      fileName: `${baseName}.docx`,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  private async getOwned(tenantId: string, id: string): Promise<TemplateRow> {
    const row = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId },
      select: TEMPLATE_INFO_SELECT,
    });
    if (!row) throw new NotFoundException("Vorlage nicht gefunden");
    return row;
  }
}

const TEMPLATE_INFO_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  documentType: true,
  fileName: true,
  placeholders: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;
