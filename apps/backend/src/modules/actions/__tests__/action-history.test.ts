import { describe, expect, it } from "vitest";
import { toHistoryEntry } from "../actions.service";

const BASE = {
  id: "exec-1",
  actionId: "action-create-quote",
  actionName: "action-create-quote",
  status: "SUCCESS",
  executedAt: new Date("2026-08-10T09:30:00.000Z"),
  durationMs: 812,
  error: null,
  user: { firstName: "Jessica", lastName: "Niestatek", email: "j.niestatek@amikon.de" },
};

describe("toHistoryEntry", () => {
  it("summarises a quote execution", () => {
    const entry = toHistoryEntry({
      ...BASE,
      payload: {
        customerName: "Bergmann Handels GmbH",
        currency: "EUR",
        lineItems: [
          { quantity: 2, pricePerUnit: 100 },
          { quantity: 1, pricePerUnit: 50 },
        ],
      },
      result: {
        erpQuoteNumber: "1009",
        document: { templateId: "tpl-1", documentType: "OFFER", data: {} },
      },
    });

    expect(entry.status).toBe("success");
    expect(entry.referenceNumber).toBe("1009");
    expect(entry.customerName).toBe("Bergmann Handels GmbH");
    expect(entry.totalNet).toBe(250);
    expect(entry.positionCount).toBe(2);
    expect(entry.currency).toBe("EUR");
    expect(entry.userName).toBe("Jessica Niestatek");
    expect(entry.document?.templateId).toBe("tpl-1");
  });

  it("applies per-line discounts to the net total", () => {
    const entry = toHistoryEntry({
      ...BASE,
      payload: { lineItems: [{ quantity: 2, pricePerUnit: 100, discount: 10 }] },
      result: {},
    });
    expect(entry.totalNet).toBe(180);
  });

  it("rounds the total to two decimals", () => {
    const entry = toHistoryEntry({
      ...BASE,
      payload: { lineItems: [{ quantity: 3, pricePerUnit: 8.39 }] },
      result: {},
    });
    expect(entry.totalNet).toBe(25.17);
  });

  it("keeps a failed execution readable instead of dropping it", () => {
    const entry = toHistoryEntry({
      ...BASE,
      status: "FAILED",
      error: "Plenty-Login fehlgeschlagen",
      payload: { customerName: "Testkunde" },
      result: null,
    });
    expect(entry.status).toBe("failed");
    expect(entry.error).toBe("Plenty-Login fehlgeschlagen");
    expect(entry.customerName).toBe("Testkunde");
    expect(entry.totalNet).toBeNull();
    expect(entry.positionCount).toBeNull();
    expect(entry.document).toBeNull();
  });

  it("survives payloads and results that are not objects", () => {
    const entry = toHistoryEntry({ ...BASE, payload: "kaputt", result: 42 });
    expect(entry.totalNet).toBeNull();
    expect(entry.customerName).toBeNull();
    expect(entry.referenceNumber).toBeNull();
    expect(entry.document).toBeNull();
  });

  it("ignores non-numeric quantities and prices instead of producing NaN", () => {
    const entry = toHistoryEntry({
      ...BASE,
      payload: { lineItems: [{ quantity: "zwei", pricePerUnit: null }, { quantity: 1, pricePerUnit: 10 }] },
      result: {},
    });
    expect(entry.totalNet).toBe(10);
  });

  it("falls back to the e-mail when the user has no name", () => {
    const entry = toHistoryEntry({
      ...BASE,
      user: { firstName: null, lastName: null, email: "p.kleinfeld@amikon.de" },
      payload: {},
      result: {},
    });
    expect(entry.userName).toBe("p.kleinfeld@amikon.de");
  });
});
