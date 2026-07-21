import { describe, expect, it } from "vitest";
import { formatGermanDate, formatGermanNumber, formatValue } from "../formatters";

describe("formatGermanNumber", () => {
  it("formats with thousands separator and two decimals", () => {
    expect(formatGermanNumber(1234.56)).toBe("1.234,56");
    expect(formatGermanNumber(1234.5)).toBe("1.234,50");
    expect(formatGermanNumber(0)).toBe("0,00");
    expect(formatGermanNumber(74)).toBe("74,00");
    expect(formatGermanNumber(-99.999)).toBe("-100,00");
  });
});

describe("formatGermanDate", () => {
  it("formats ISO strings as TT.MM.JJJJ", () => {
    expect(formatGermanDate("2026-07-21")).toBe("21.07.2026");
    expect(formatGermanDate("2026-01-05T10:30:00Z")).toBe("05.01.2026");
  });

  it("formats Date objects", () => {
    expect(formatGermanDate(new Date(2026, 11, 24))).toBe("24.12.2026");
  });

  it("returns empty string for invalid input", () => {
    expect(formatGermanDate("kein datum")).toBe("");
  });
});

describe("formatValue", () => {
  it("keeps integers whole and formats decimals with two digits", () => {
    expect(formatValue(2)).toBe("2");
    expect(formatValue(1234)).toBe("1.234");
    expect(formatValue(2.5)).toBe("2,50");
  });

  it("converts ISO date strings to German dates", () => {
    expect(formatValue("2026-07-21")).toBe("21.07.2026");
  });

  it("passes ordinary strings through unchanged", () => {
    expect(formatValue("7 Tage netto")).toBe("7 Tage netto");
    expect(formatValue("1.234,56")).toBe("1.234,56");
  });

  it("returns undefined for null/undefined/NaN", () => {
    expect(formatValue(null)).toBeUndefined();
    expect(formatValue(undefined)).toBeUndefined();
    expect(formatValue(Number.NaN)).toBeUndefined();
  });
});
