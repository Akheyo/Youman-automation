import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, formatValue } from "../formatters";
import { CreateQuoteSchema, QUOTE_TEXT_DEFAULTS, QUOTE_TEXT_DEFAULTS_EN } from "@youman/shared";

describe("formatNumber", () => {
  it("uses German separators by default", () => {
    expect(formatNumber(1234.5)).toBe("1.234,50");
    expect(formatNumber(1234.5, "de")).toBe("1.234,50");
  });

  it("uses English separators for English documents", () => {
    expect(formatNumber(1234.5, "en")).toBe("1,234.50");
    expect(formatNumber(1000000, "en")).toBe("1,000,000.00");
  });
});

describe("formatDate", () => {
  it("writes TT.MM.JJJJ in German", () => {
    expect(formatDate("2026-08-14", "de")).toBe("14.08.2026");
  });

  it("spells the month out in English", () => {
    // "08/14" und "14/08" bedeuten je nach Land Verschiedenes – ein Angebot
    // ist kein Ort für Datumsrätsel.
    expect(formatDate("2026-08-14", "en")).toBe("14 August 2026");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatDate("kein Datum", "en")).toBe("");
    expect(formatDate("kein Datum", "de")).toBe("");
  });
});

describe("formatValue", () => {
  it("formats numbers, dates and integers per language", () => {
    expect(formatValue(12.5, "en")).toBe("12.50");
    expect(formatValue(2, "en")).toBe("2");
    expect(formatValue("2026-08-14", "en")).toBe("14 August 2026");
    expect(formatValue("2026-08-14", "de")).toBe("14.08.2026");
  });

  it("leaves plain text untouched in both languages", () => {
    expect(formatValue("Tesla Engineering Germany GmbH", "en")).toBe("Tesla Engineering Germany GmbH");
    expect(formatValue(null, "en")).toBeUndefined();
  });
});

describe("quote language on the request", () => {
  const base = {
    customerId: "1",
    lineItems: [{ productId: "1", quantity: 1, unit: "ST", pricePerUnit: 10 }],
  };

  it("defaults to German", () => {
    expect(CreateQuoteSchema.parse(base).language).toBe("de");
  });

  it("accepts English", () => {
    expect(CreateQuoteSchema.parse({ ...base, language: "en" }).language).toBe("en");
  });

  it("rejects unknown languages instead of silently falling back", () => {
    expect(() => CreateQuoteSchema.parse({ ...base, language: "fr" })).toThrow();
  });
});

describe("quote texts", () => {
  it("has an English counterpart for every German default", () => {
    expect(Object.keys(QUOTE_TEXT_DEFAULTS_EN).sort()).toEqual(Object.keys(QUOTE_TEXT_DEFAULTS).sort());
    for (const value of Object.values(QUOTE_TEXT_DEFAULTS_EN)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
