import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlentyMockConnector } from "@youman/connector-plenty";
import { QUOTE_TEXT_DEFAULTS } from "@youman/shared";
import { ActionsService } from "../actions.service";
import type { PrismaService } from "../../../database/prisma.service";
import type { ConnectorsService } from "../../connectors/connectors.service";
import type { AuditService } from "../../audit/audit.service";
import type { TemplatesService } from "../../templates/templates.service";

/**
 * Beweis für die frei einstellbaren Angebotstexte: Anrede, Lieferdatum,
 * Zahlungsart, Zahlungsziel und Versandart standen bisher fest im Code und
 * landen jetzt aus den Mandanten-Einstellungen im Dokument. Fehlt ein Wert
 * (oder die Einstellungen komplett), greift exakt der frühere Festwert –
 * bestehende Angebote sehen also unverändert aus.
 */
describe("ActionsService – einstellbare Angebotstexte", () => {
  /** Was tenantSettings.findUnique für die Texte zurückgibt. */
  let storedTexts: Record<string, unknown> | null;

  const prismaStub = {
    actionExecution: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, executedAt: new Date() })),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    actionDefinition: { findUnique: vi.fn(async () => ({ configJson: {} })) },
    user: { findUnique: vi.fn(async () => ({ firstName: "Max", lastName: "Admin", email: "a@b.de" })) },
    tenantSettings: {
      findUnique: vi.fn(async ({ select }: { select?: Record<string, boolean> }) =>
        // Der Nummernkreis-Aufruf fragt quoteNumberStep, der Text-Aufruf die Texte.
        select?.["quoteNumberStep"] ? { quoteNumberStep: 1 } : storedTexts
      ),
      update: vi.fn(async () => ({ quoteNumberNext: 1001 })),
    },
  };

  const connector = new PlentyMockConnector("tenant-a");
  const connectorsStub = { getConnector: vi.fn(async () => connector) };
  const auditStub = { log: vi.fn(async () => undefined) };
  const templatesStub = { findDefault: vi.fn(async () => null) };
  let service: ActionsService;

  /** Führt ein Angebot aus und liefert die Platzhalter-Daten des Dokuments. */
  const runQuote = async (): Promise<Record<string, unknown>> => {
    const res = await service.executeAction({
      actionId: "action-create-quote",
      tenantId: "tenant-a",
      userId: "user-1",
      payload: {
        customerId: "118",
        currency: "EUR",
        lineItems: [
          { productId: "1101", articleNumber: "X", designation: "Y", quantity: 1, unit: "ST", pricePerUnit: 10 },
        ],
      },
      clientTimestamp: "2026-07-30T00:00:00Z",
    });
    const result = res.result as { document: { data: Record<string, unknown> } };
    return result.document.data;
  };

  beforeEach(() => {
    service = new ActionsService(
      prismaStub as unknown as PrismaService,
      connectorsStub as unknown as ConnectorsService,
      auditStub as unknown as AuditService,
      templatesStub as unknown as TemplatesService
    );
  });

  it("übernimmt die eingestellten Texte ins Angebot", async () => {
    storedTexts = {
      quoteSalutation: "Guten Tag,",
      quoteDeliveryDate: "KW 40",
      quotePaymentMethod: "Vorkasse",
      quotePaymentTerms: "14 Tage netto",
      quoteShippingMethod: "Selbstabholung",
    };

    const data = await runQuote();
    expect(data["anrede"]).toBe("Guten Tag,");
    expect(data["lieferdatum"]).toBe("KW 40");
    expect(data["zahlungsart"]).toBe("Vorkasse");
    expect(data["zahlungsziel"]).toBe("14 Tage netto");
    expect(data["versandart"]).toBe("Selbstabholung");
  });

  it("nutzt die bisherigen Festwerte, wenn keine Einstellungen vorliegen", async () => {
    storedTexts = null;

    const data = await runQuote();
    expect(data["anrede"]).toBe(QUOTE_TEXT_DEFAULTS.quoteSalutation);
    expect(data["lieferdatum"]).toBe(QUOTE_TEXT_DEFAULTS.quoteDeliveryDate);
    expect(data["zahlungsart"]).toBe(QUOTE_TEXT_DEFAULTS.quotePaymentMethod);
    expect(data["zahlungsziel"]).toBe(QUOTE_TEXT_DEFAULTS.quotePaymentTerms);
    expect(data["versandart"]).toBe(QUOTE_TEXT_DEFAULTS.quoteShippingMethod);
  });

  it("fällt je Feld einzeln auf den Festwert zurück (leer = Standard)", async () => {
    storedTexts = {
      quoteSalutation: "Moin,",
      quoteDeliveryDate: "   ", // nur Leerzeichen zählt als "nicht gesetzt"
      quotePaymentMethod: "",
      quotePaymentTerms: null,
      quoteShippingMethod: undefined,
    };

    const data = await runQuote();
    expect(data["anrede"]).toBe("Moin,");
    expect(data["lieferdatum"]).toBe(QUOTE_TEXT_DEFAULTS.quoteDeliveryDate);
    expect(data["zahlungsart"]).toBe(QUOTE_TEXT_DEFAULTS.quotePaymentMethod);
    expect(data["zahlungsziel"]).toBe(QUOTE_TEXT_DEFAULTS.quotePaymentTerms);
    expect(data["versandart"]).toBe(QUOTE_TEXT_DEFAULTS.quoteShippingMethod);
  });
});
