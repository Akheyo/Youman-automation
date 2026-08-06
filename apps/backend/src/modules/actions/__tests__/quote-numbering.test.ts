import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlentyMockConnector } from "@youman/connector-plenty";
import { ActionsService } from "../actions.service";
import type { PrismaService } from "../../../database/prisma.service";
import type { ConnectorsService } from "../../connectors/connectors.service";
import type { AuditService } from "../../audit/audit.service";
import type { TemplatesService } from "../../templates/templates.service";

/**
 * Beweis für die konfigurierbare Angebotsnummer: Start + Schrittweite werden
 * eingehalten und zählen je Angebot korrekt hoch (atomarer increment).
 */
describe("ActionsService – konfigurierbare Angebotsnummer", () => {
  /** In-Memory-Nachbildung von tenant_settings mit laufendem Zähler. */
  let next: number;
  let step: number;

  const prismaStub = {
    actionExecution: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, executedAt: new Date() })),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    actionDefinition: { findUnique: vi.fn(async () => ({ configJson: {} })) },
    user: { findUnique: vi.fn(async () => ({ firstName: "A", lastName: "B", email: "a@b.de" })) },
    tenantSettings: {
      findUnique: vi.fn(async () => ({ quoteNumberStep: step })),
      update: vi.fn(async () => {
        next += step; // increment
        return { quoteNumberNext: next };
      }),
    },
  };

  const connector = new PlentyMockConnector("tenant-a");
  const connectorsStub = { getConnector: vi.fn(async () => connector) };
  const auditStub = { log: vi.fn(async () => undefined) };
  const templatesStub = { findDefault: vi.fn(async () => null) };
  let service: ActionsService;

  const payload = {
    customerId: "118",
    currency: "EUR",
    lineItems: [{ productId: "1101", articleNumber: "X", designation: "Y", quantity: 1, unit: "ST", pricePerUnit: 10 }],
  };

  const run = async () => {
    const res = await service.executeAction({
      actionId: "action-create-quote",
      tenantId: "tenant-a",
      userId: "user-1",
      payload,
      clientTimestamp: "2026-07-23T00:00:00Z",
    });
    return (res.result as Record<string, unknown>)["erpQuoteNumber"] as string;
  };

  beforeEach(() => {
    service = new ActionsService(
      prismaStub as unknown as PrismaService,
      connectorsStub as unknown as ConnectorsService,
      auditStub as unknown as AuditService,
      templatesStub as unknown as TemplatesService
    );
  });

  it("beginnt bei der eingestellten Startnummer und zählt mit Schrittweite 1", async () => {
    next = 1000; step = 1;
    expect(await run()).toBe("1000");
    expect(await run()).toBe("1001");
    expect(await run()).toBe("1002");
  });

  it("respektiert eine Schrittweite > 1", async () => {
    next = 5000; step = 10;
    expect(await run()).toBe("5000");
    expect(await run()).toBe("5010");
    expect(await run()).toBe("5020");
  });

  it("nutzt eine frei gewählte Startnummer", async () => {
    next = 250; step = 1;
    expect(await run()).toBe("0250"); // auf 4 Stellen aufgefüllt
  });
});

/**
 * Beweis für die umschaltbare Nummernquelle: Mit createQuoteInErp legt die
 * Aktion das Angebot im ERP an und übernimmt dessen Belegnummer. Ein stiller
 * Rückfall auf eine lokale Nummer wäre gefährlich – die Nummer würde im ERP
 * später an einen anderen Beleg vergeben.
 */
describe("ActionsService – Angebotsnummer aus dem ERP", () => {
  const connector = new PlentyMockConnector("tenant-a");
  const connectorsStub = { getConnector: vi.fn(async () => connector) };
  const auditStub = { log: vi.fn(async () => undefined) };
  const templatesStub = { findDefault: vi.fn(async () => null) };

  const payload = {
    customerId: "118",
    currency: "EUR",
    lineItems: [{ productId: "1101", articleNumber: "X", designation: "Y", quantity: 1, unit: "ST", pricePerUnit: 10 }],
  };

  const makeService = (erpMode: boolean) => {
    const prismaStub = {
      actionExecution: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, executedAt: new Date() })),
        update: vi.fn(async () => ({})),
        count: vi.fn(async () => 0),
      },
      actionDefinition: { findUnique: vi.fn(async () => ({ configJson: {} })) },
      user: { findUnique: vi.fn(async () => ({ firstName: "A", lastName: "B", email: "a@b.de" })) },
      tenantSettings: {
        findUnique: vi.fn(async ({ select }: { select?: Record<string, boolean> }) => {
          if (select?.["createQuoteInErp"]) return { createQuoteInErp: erpMode };
          if (select?.["quoteNumberStep"]) return { quoteNumberStep: 1 };
          return null;
        }),
        update: vi.fn(async () => ({ quoteNumberNext: 1001 })),
      },
    };
    return new ActionsService(
      prismaStub as unknown as PrismaService,
      connectorsStub as unknown as ConnectorsService,
      auditStub as unknown as AuditService,
      templatesStub as unknown as TemplatesService
    );
  };

  const run = async (erpMode: boolean) => {
    const res = await makeService(erpMode).executeAction({
      actionId: "action-create-quote",
      tenantId: "tenant-a",
      userId: "user-1",
      payload,
      clientTimestamp: "2026-08-06T00:00:00Z",
    });
    return (res.result as Record<string, unknown>)["erpQuoteNumber"] as string;
  };

  it("nutzt im ERP-Modus die Belegnummer des angelegten Angebots", async () => {
    const number = await run(true);
    // Der Mock-Connector vergibt fortlaufende ERP-Ids – Hauptsache: NICHT die
    // lokale 1000er-Nummer, sondern eine echte ERP-Belegnummer.
    expect(number).not.toBe("1000");
    expect(Number(number)).toBeGreaterThan(0);
  });

  it("bleibt ohne die Einstellung bei der lokalen Nummer", async () => {
    expect(await run(false)).toBe("1000");
  });

  it("bricht sichtbar ab, wenn das ERP das Angebot nicht anlegen kann", async () => {
    const failing = { getConnector: vi.fn(async () => ({
      createQuote: vi.fn(async () => { throw new Error("ERP nicht erreichbar"); }),
      getCustomer: vi.fn(async () => { throw new Error("nope"); }),
    })) };
    const prismaStub = {
      actionExecution: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, executedAt: new Date() })),
        update: vi.fn(async () => ({})),
        count: vi.fn(async () => 0),
      },
      actionDefinition: { findUnique: vi.fn(async () => ({ configJson: {} })) },
      user: { findUnique: vi.fn(async () => ({ firstName: "A", lastName: "B", email: "a@b.de" })) },
      tenantSettings: { findUnique: vi.fn(async () => ({ createQuoteInErp: true })), update: vi.fn() },
    };
    const service = new ActionsService(
      prismaStub as unknown as PrismaService,
      failing as unknown as ConnectorsService,
      auditStub as unknown as AuditService,
      templatesStub as unknown as TemplatesService
    );
    await expect(
      service.executeAction({
        actionId: "action-create-quote",
        tenantId: "tenant-a",
        userId: "user-1",
        payload,
        clientTimestamp: "2026-08-06T00:00:00Z",
      })
    ).rejects.toThrow();
    // Keine stille Ersatznummer:
    expect(prismaStub.tenantSettings.update).not.toHaveBeenCalled();
  });
});
