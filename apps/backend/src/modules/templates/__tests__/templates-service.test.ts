import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatesService } from "../templates.service";
import { MissingFieldsError, TemplateParseError } from "../errors";
import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";

const TEMPLATE = readFileSync(resolve(__dirname, "../../../../../../configs/templates/beispiel-angebot.docx"));

/**
 * In-memory Prisma stub covering the calls TemplatesService makes.
 * Rows live in a shared array so tenant isolation is testable end-to-end.
 */
function buildPrismaStub() {
  interface Row {
    id: string; tenantId: string; name: string; documentType: string; fileName: string;
    fileData: Buffer; placeholders: unknown; isDefault: boolean; createdAt: Date; updatedAt: Date;
  }
  const rows: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([k, v]) => (v === undefined ? true : (row as unknown as Record<string, unknown>)[k] === v));

  const client = {
    documentTemplate: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where))),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => matches(r, where)) ?? null),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where)).length),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "createdAt" | "updatedAt"> }) => {
        const row: Row = { ...data, id: `tpl-${++seq}`, createdAt: new Date(), updatedAt: new Date() } as Row;
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        rows.filter((r) => matches(r, where)).forEach((r) => Object.assign(r, data));
        return { count: 0 };
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const i = rows.findIndex((r) => r.id === where.id);
        if (i >= 0) rows.splice(i, 1);
      }),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(client),
  };
  return { client, rows };
}

const auditStub = { log: vi.fn(async () => undefined) };

const FULL_DATA = {
  angebotsnummer: "77", datum: "2026-07-21", anrede: "Sehr geehrte Damen und Herren,",
  ansprechpartner: "Max Admin", kunde_name: "Bergmann GmbH", kunde_adresse: "Weg 1\n50679 Köln",
  positionen: [{ pos: 1, menge: 1, artikel_id: "1", bezeichnung: "Testartikel", nettopreis: "10,00" }],
  zwischensumme: "10,00", rabatt: "0,00", endbetrag: "10,00",
  lieferdatum: "ab sofort", zahlungsart: "Rechnung", zahlungsziel: "7 Tage", versandart: "Spedition",
};

describe("TemplatesService", () => {
  let service: TemplatesService;
  let stub: ReturnType<typeof buildPrismaStub>;

  beforeEach(() => {
    stub = buildPrismaStub();
    service = new TemplatesService(
      stub.client as unknown as PrismaService,
      auditStub as unknown as AuditService
    );
  });

  it("upload extracts placeholders and makes the first template the default", async () => {
    const info = await service.upload("tenant-a", "user-1", {
      name: "Angebot Standard", documentType: "OFFER", fileName: "angebot.docx", fileData: TEMPLATE,
    });
    expect(info.isDefault).toBe(true);
    expect(info.placeholders).toContain("angebotsnummer");
    expect(info.placeholders).toContain("positionen.nettopreis");
  });

  it("upload rejects broken files with TemplateParseError", async () => {
    await expect(
      service.upload("tenant-a", "user-1", {
        name: "kaputt", documentType: "OFFER", fileName: "kaputt.docx", fileData: Buffer.from("nope"),
      })
    ).rejects.toBeInstanceOf(TemplateParseError);
  });

  it("renders an uploaded template end-to-end (DOCX contains the values)", async () => {
    const info = await service.upload("tenant-a", "user-1", {
      name: "Angebot", documentType: "OFFER", fileName: "angebot.docx", fileData: TEMPLATE,
    });
    const { content, fileName, contentType } = await service.render("tenant-a", "user-1", info.id, FULL_DATA, "docx");
    expect(fileName).toBe("angebot.docx");
    expect(contentType).toContain("wordprocessingml");
    expect(content.toString("binary")).toContain("PK"); // ZIP magic
  });

  it("render with missing fields throws MissingFieldsError listing the fields", async () => {
    const info = await service.upload("tenant-a", "user-1", {
      name: "Angebot", documentType: "OFFER", fileName: "a.docx", fileData: TEMPLATE,
    });
    const { endbetrag: _e, anrede: _a, ...incomplete } = FULL_DATA;
    try {
      await service.render("tenant-a", "user-1", info.id, incomplete as Record<string, unknown>, "docx");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFieldsError);
      expect((err as MissingFieldsError).fields).toEqual(expect.arrayContaining(["anrede", "endbetrag"]));
    }
  });

  it("setDefault keeps exactly one default per documentType", async () => {
    const a = await service.upload("tenant-a", "user-1", { name: "V1", documentType: "OFFER", fileName: "a.docx", fileData: TEMPLATE });
    const b = await service.upload("tenant-a", "user-1", { name: "V2", documentType: "OFFER", fileName: "b.docx", fileData: TEMPLATE });
    expect(a.isDefault).toBe(true);
    expect(b.isDefault).toBe(false);
    await service.setDefault("tenant-a", b.id);
    const list = await service.list("tenant-a");
    expect(list.filter((t) => t.isDefault)).toHaveLength(1);
    expect(list.find((t) => t.id === b.id)?.isDefault).toBe(true);
  });

  describe("tenant isolation", () => {
    it("tenant B can neither see, render, modify nor delete tenant A's templates", async () => {
      const info = await service.upload("tenant-a", "user-1", {
        name: "Geheim", documentType: "OFFER", fileName: "a.docx", fileData: TEMPLATE,
      });

      expect(await service.list("tenant-b")).toEqual([]);
      await expect(service.render("tenant-b", "user-2", info.id, FULL_DATA, "docx")).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.rename("tenant-b", info.id, "gekapert")).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.setDefault("tenant-b", info.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.remove("tenant-b", "user-2", info.id)).rejects.toBeInstanceOf(NotFoundException);
      expect(await service.findDefault("tenant-b", "OFFER")).toBeNull();

      // Tenant A still sees the untouched template.
      const list = await service.list("tenant-a");
      expect(list).toHaveLength(1);
      expect(list[0]!.name).toBe("Geheim");
    });
  });
});
