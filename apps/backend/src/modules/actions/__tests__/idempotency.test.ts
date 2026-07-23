import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import { PlentyMockConnector } from "@youman/connector-plenty";
import { ActionsService } from "../actions.service";
import type { PrismaService } from "../../../database/prisma.service";
import type { ConnectorsService } from "../../connectors/connectors.service";
import type { AuditService } from "../../audit/audit.service";
import type { TemplatesService } from "../../templates/templates.service";

/**
 * Beweis der Idempotenz-Schutzschicht: Ein wiederholter schreibender Request
 * mit derselben Idempotenz-ID erzeugt KEINEN zweiten ERP-Eintrag, sondern
 * liefert das gespeicherte Ergebnis zurück. Fehlgeschlagene Ausführungen geben
 * den Key frei, damit ein bewusster Retry wieder ausgeführt wird.
 */
describe("ActionsService – Idempotenz", () => {
  let service: ActionsService;
  let connector: PlentyMockConnector;
  let createCustomerSpy: ReturnType<typeof vi.spyOn>;

  /** In-Memory-Nachbildung der idempotency_keys-Tabelle inkl. Unique-Constraint. */
  const keyStore = new Map<string, { status: string; result?: unknown; updatedAt: Date }>();

  const prismaStub = {
    actionExecution: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, executedAt: new Date() })),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    actionDefinition: { findUnique: vi.fn(async () => ({ configJson: {} })) },
    user: { findUnique: vi.fn(async () => ({ firstName: "Max", lastName: "Admin", email: "a@b.de" })) },
    idempotencyKey: {
      create: vi.fn(async ({ data }: { data: { tenantId: string; key: string } }) => {
        const k = `${data.tenantId}:${data.key}`;
        if (keyStore.has(k)) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        keyStore.set(k, { status: "RUNNING", updatedAt: new Date() });
        return {};
      }),
      findUnique: vi.fn(async ({ where }: { where: { tenantId_key: { tenantId: string; key: string } } }) => {
        const k = `${where.tenantId_key.tenantId}:${where.tenantId_key.key}`;
        const row = keyStore.get(k);
        return row ? { status: row.status, result: row.result ?? null, updatedAt: row.updatedAt } : null;
      }),
      update: vi.fn(async ({ where, data }: {
        where: { tenantId_key: { tenantId: string; key: string } };
        data: { status?: string; result?: unknown };
      }) => {
        const k = `${where.tenantId_key.tenantId}:${where.tenantId_key.key}`;
        const row = keyStore.get(k);
        if (!row) throw new Error("not found");
        if (data.status) row.status = data.status;
        if (data.result !== undefined) row.result = data.result;
        return {};
      }),
      updateMany: vi.fn(async ({ where }: {
        where: { tenantId: string; key: string; status: string; updatedAt: { lt: Date } };
      }) => {
        const k = `${where.tenantId}:${where.key}`;
        const row = keyStore.get(k);
        if (row && row.status === where.status && row.updatedAt < where.updatedAt.lt) {
          row.updatedAt = new Date();
          return { count: 1 };
        }
        return { count: 0 };
      }),
      delete: vi.fn(async ({ where }: { where: { tenantId_key: { tenantId: string; key: string } } }) => {
        keyStore.delete(`${where.tenantId_key.tenantId}:${where.tenantId_key.key}`);
        return {};
      }),
    },
  };

  const auditStub = { log: vi.fn(async () => undefined) };
  const templatesStub = { findDefault: vi.fn(async () => null) };

  const payload = {
    customerType: "person",
    firstName: "Max",
    lastName: "Mustermann",
    email: "max@example.com",
    address: {
      street: "Hauptstraße",
      streetNumber: "1",
      zip: "10115",
      city: "Berlin",
      countryCode: "DE",
    },
  };

  const request = (idempotencyKey?: string) => ({
    actionId: "action-create-customer",
    tenantId: "tenant-a",
    userId: "user-1",
    payload,
    clientTimestamp: "2026-07-23T00:00:00Z",
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    keyStore.clear();
    connector = new PlentyMockConnector("tenant-a");
    createCustomerSpy = vi.spyOn(connector, "createCustomer");
    const connectorsStub = { getConnector: vi.fn(async () => connector) };
    service = new ActionsService(
      prismaStub as unknown as PrismaService,
      connectorsStub as unknown as ConnectorsService,
      auditStub as unknown as AuditService,
      templatesStub as unknown as TemplatesService
    );
  });

  it("führt den zweiten Request mit derselben ID NICHT erneut im ERP aus", async () => {
    const first = await service.executeAction(request("idem-0001-abcd"));
    expect(first.status).toBe("success");
    expect(createCustomerSpy).toHaveBeenCalledTimes(1);

    const second = await service.executeAction(request("idem-0001-abcd"));
    // Kein zweiter ERP-Aufruf:
    expect(createCustomerSpy).toHaveBeenCalledTimes(1);
    // Gespeichertes Ergebnis (gleiche Execution-ID) zurückgegeben:
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("success");
  });

  it("verschiedene IDs führen normal beide aus", async () => {
    await service.executeAction(request("idem-0002-erste"));
    await service.executeAction(request("idem-0003-zweite"));
    expect(createCustomerSpy).toHaveBeenCalledTimes(2);
  });

  it("gibt den Key nach einem Fehlschlag frei, sodass ein Retry wieder ausführt", async () => {
    createCustomerSpy.mockRejectedValueOnce(new Error("ERP down"));
    await expect(service.executeAction(request("idem-0004-fail"))).rejects.toThrow();
    // Retry mit derselben ID läuft erneut und gelingt:
    const retry = await service.executeAction(request("idem-0004-fail"));
    expect(retry.status).toBe("success");
    expect(createCustomerSpy).toHaveBeenCalledTimes(2);
  });

  it("weist einen parallel laufenden Request mit derselben ID mit 409 ab", async () => {
    // Key manuell als frisch-RUNNING markieren (Ausführung "läuft noch"):
    keyStore.set("tenant-a:idem-0005-race", { status: "RUNNING", updatedAt: new Date() });
    await expect(service.executeAction(request("idem-0005-race"))).rejects.toThrow(ConflictException);
    expect(createCustomerSpy).not.toHaveBeenCalled();
  });

  it("übernimmt einen verwaisten RUNNING-Key nach der Stale-Frist", async () => {
    const stale = new Date(Date.now() - 11 * 60 * 1000);
    keyStore.set("tenant-a:idem-0006-orphan", { status: "RUNNING", updatedAt: stale });
    const result = await service.executeAction(request("idem-0006-orphan"));
    expect(result.status).toBe("success");
    expect(createCustomerSpy).toHaveBeenCalledTimes(1);
  });

  it("ohne Idempotenz-ID bleibt das Verhalten unverändert", async () => {
    await service.executeAction(request());
    expect(createCustomerSpy).toHaveBeenCalledTimes(1);
    expect(prismaStub.idempotencyKey.create).not.toHaveBeenCalled();
  });
});
