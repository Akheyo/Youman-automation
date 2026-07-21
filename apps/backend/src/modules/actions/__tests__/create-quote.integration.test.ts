import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlentyMockConnector } from "@youman/connector-plenty";
import { ActionsService } from "../actions.service";
import type { PrismaService } from "../../../database/prisma.service";
import type { ConnectorsService } from "../../connectors/connectors.service";
import type { AuditService } from "../../audit/audit.service";
import type { TemplatesService } from "../../templates/templates.service";

/**
 * End-to-end (offline) proof that the minimal quote payload the desktop form
 * sends now succeeds through ActionsService → connector → document assembly.
 */
describe("ActionsService – create quote (minimal payload)", () => {
  let service: ActionsService;
  const executions: Record<string, unknown>[] = [];

  const prismaStub = {
    actionExecution: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, executedAt: new Date() };
        executions.push(row);
        return row;
      }),
      update: vi.fn(async () => ({})),
    },
    actionDefinition: {
      // No documentOutput here → the post-success document step is skipped,
      // isolating the schema+mapping fix under test.
      findUnique: vi.fn(async () => ({ configJson: {} })),
    },
    user: { findUnique: vi.fn(async () => ({ firstName: "Max", lastName: "Admin", email: "admin@demo.adept.de" })) },
  };

  const connector = new PlentyMockConnector("tenant-a");
  const connectorsStub = { getConnector: vi.fn(async () => connector) };
  const auditStub = { log: vi.fn(async () => undefined) };
  const templatesStub = { findDefault: vi.fn(async () => null) };

  beforeEach(() => {
    executions.length = 0;
    service = new ActionsService(
      prismaStub as unknown as PrismaService,
      connectorsStub as unknown as ConnectorsService,
      auditStub as unknown as AuditService,
      templatesStub as unknown as TemplatesService
    );
  });

  it("creates a quote from customer + one line item + currency", async () => {
    // Exactly what the form sends: null optionals, empty per-line date.
    const payload = {
      customerId: "118",
      deliveryAddressId: null,
      currency: "EUR",
      validUntil: null,
      notes: null,
      lineItems: [
        {
          productId: "1101",
          articleNumber: "TRK-500-BLK",
          designation: "Trekkingrucksack Fjell 50 L schwarz",
          quantity: 1,
          unit: "ST",
          pricePerUnit: 74.9,
          discount: 0,
          deliveryDate: "",
          notes: "",
        },
      ],
    };

    const result = await service.executeAction({
      actionId: "action-create-quote",
      tenantId: "tenant-a",
      userId: "user-1",
      payload,
      clientTimestamp: "2026-07-22T00:00:00Z",
    });

    expect(result.status).toBe("success");
    expect(result.error).toBeNull();
    const data = result.result as Record<string, unknown>;
    expect(data["erpQuoteId"]).toBeTruthy();
    expect(data["erpQuoteNumber"]).toBeTruthy();
    // Document-ready data resolved from the customer (proves customer name lookup).
    expect((data["kunde"] as { name: string }).name).toBe("Bergmann Handels GmbH");
    expect(data["positionen"]).toHaveLength(1);
    expect(data["endbetrag"]).toBe("74,90");
  });
});
