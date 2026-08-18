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
      // Used to derive the running quote number; no quotes yet → next is 0001.
      count: vi.fn(async () => 0),
    },
    actionDefinition: {
      // No documentOutput here → the post-success document step is skipped,
      // isolating the schema+mapping fix under test.
      findUnique: vi.fn(async () => ({ configJson: {} })),
    },
    user: { findUnique: vi.fn(async () => ({ firstName: "Max", lastName: "Admin", email: "admin@demo.adept.de" })) },
    // Konfigurierbare Angebotsnummer: nächste Nummer 1000, Schrittweite 1.
    tenantSettings: {
      findUnique: vi.fn(async () => ({ quoteNumberStep: 1 })),
      update: vi.fn(async () => ({ quoteNumberNext: 1001 })), // vergeben: 1001 - 1 = 1000
    },
  };

  const connector = new PlentyMockConnector("tenant-a");
  // createQuote must NOT be called – the Angebot is a document, not an ERP order.
  const createQuoteSpy = vi.spyOn(connector, "createQuote");
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
    // No ERP order was created – the quote lives only as an adept document.
    expect(createQuoteSpy).not.toHaveBeenCalled();
    const data = result.result as Record<string, unknown>;
    // Locally assigned running number (JJJJ-NNNN), not an ERP order id.
    expect(data["erpQuoteNumber"]).toBe("1000"); // konfigurierbare Startnummer

    // The document is attached DIRECTLY (independent of any DB documentOutput).
    const doc = data["document"] as { templateId: string | null; documentType: string; data: Record<string, unknown> };
    expect(doc).toBeTruthy();
    expect(doc.documentType).toBe("OFFER");
    // Flat placeholder set matching the template.
    expect(doc.data["angebotsnummer"]).toBe("1000");
    expect(doc.data["kunde_name"]).toBe("Bergmann Handels GmbH"); // resolved via getCustomer
    expect(doc.data["kunde_adresse"]).toContain("Köln");
    expect(doc.data["positionen"]).toHaveLength(1);
    expect(doc.data["endbetrag"]).toBe("74,90");
    expect(doc.data["zahlungsart"]).toBe("Rechnung");
  });

  /** Derselbe Mindest-Payload, nur mit anderer Lieferadresse. */
  const quoteWith = async (deliveryAddressId: string | null, deliveryAddress?: string) => {
    const result = await service.executeAction({
      actionId: "action-create-quote",
      tenantId: "tenant-a",
      userId: "user-1",
      payload: {
        customerId: "118",
        deliveryAddressId,
        deliveryAddress,
        currency: "EUR",
        validUntil: null,
        notes: null,
        lineItems: [
          { productId: "1101", quantity: 1, unit: "ST", pricePerUnit: 74.9, discount: 0, deliveryDate: "", notes: "" },
        ],
      },
      clientTimestamp: "2026-07-22T00:00:00Z",
    });
    const data = result.result as Record<string, unknown>;
    return (data["document"] as { data: Record<string, unknown> }).data;
  };

  it("puts the chosen delivery address on the document", async () => {
    // Kunde 118: 301 = Rechnung (Deutzer Freiheit), 302 = Lieferung (Gewerbepark).
    const data = await quoteWith("301");
    expect(data["lieferadresse"]).toContain("Deutzer Freiheit 72");
    // Die Anschrift des Angebots bleibt die Rechnungsadresse.
    expect(data["kunde_adresse"]).toContain("Deutzer Freiheit 72");
  });

  it("falls back to the default shipping address when none is chosen", async () => {
    const data = await quoteWith(null);
    expect(data["lieferadresse"]).toContain("Gewerbepark Süd 4a");
    expect(data["lieferadresse"]).toContain("51149 Köln");
  });

  it("prints the address edited in the form", async () => {
    // Der Freitext gewinnt gegen den Kundenstamm, sonst waere das Bearbeiten
    // des Feldes wirkungslos.
    const data = await quoteWith("302", "Baustelle Nord, Tor 3\n20095 Hamburg");
    expect(data["lieferadresse"]).toBe("Baustelle Nord, Tor 3\n20095 Hamburg");
  });

  it("ignores a blank edit and keeps the address from the customer", async () => {
    const data = await quoteWith(null, "   ");
    expect(data["lieferadresse"]).toContain("Gewerbepark S\u00fcd 4a");
  });

  it("never leaves the delivery address empty for an unknown id", async () => {
    // Ein leerer Platzhalter liesse das Rendern mit MissingFields abbrechen.
    const data = await quoteWith("999999");
    expect(String(data["lieferadresse"]).trim().length).toBeGreaterThan(0);
    expect(data["lieferadresse"]).toContain("Gewerbepark Süd 4a");
  });
});
