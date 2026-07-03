import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CostAnalysisWriteSchema,
  type CostAnalysis,
  type CostItem,
  type CostAnalysisWriteInput,
} from "@youman/shared";

/**
 * Cost-analysis persistence — one collection per tenant. Items are kept as a
 * single JSON column: they always load together with the analysis, are edited
 * as a group in the UI, and never queried individually, so a separate table
 * would only add joins without benefit.
 */
@Injectable()
export class CostAnalysesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<CostAnalysis[]> {
    const rows = await this.prisma.costAnalysis.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async get(tenantId: string, id: string): Promise<CostAnalysis> {
    const row = await this.prisma.costAnalysis.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Kostenanalyse nicht gefunden");
    return this.toDto(row);
  }

  async create(tenantId: string, userId: string, body: unknown): Promise<CostAnalysis> {
    const dto = CostAnalysisWriteSchema.parse(body);
    const row = await this.prisma.costAnalysis.create({
      data: {
        tenantId,
        createdBy: userId,
        title: dto.title,
        description: dto.description,
        currency: dto.currency,
        items: this.normalizeItems(dto) as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async update(tenantId: string, id: string, body: unknown): Promise<CostAnalysis> {
    const dto = CostAnalysisWriteSchema.parse(body);
    // Ensure the row belongs to this tenant before updating.
    await this.get(tenantId, id);
    const row = await this.prisma.costAnalysis.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        currency: dto.currency,
        items: this.normalizeItems(dto) as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async remove(tenantId: string, id: string): Promise<{ ok: true }> {
    await this.get(tenantId, id);
    await this.prisma.costAnalysis.delete({ where: { id } });
    return { ok: true };
  }

  private normalizeItems(dto: CostAnalysisWriteInput): CostItem[] {
    return dto.items.map((item) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      unitCost: item.unitCost,
      quantity: item.quantity,
      type: item.type,
      note: item.note,
    }));
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    title: string;
    description: string;
    currency: string;
    items: unknown;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CostAnalysis {
    return {
      id: row.id,
      tenantId: row.tenantId,
      title: row.title,
      description: row.description,
      currency: row.currency,
      items: Array.isArray(row.items) ? (row.items as CostItem[]) : [],
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
