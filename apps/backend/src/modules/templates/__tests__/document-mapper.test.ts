import { describe, expect, it } from "vitest";
import { resolveFieldMapping } from "../document-mapper";

const context = {
  form: { customerId: "118", notes: "eilig", lineItems: [{ quantity: 2, pricePerUnit: 10 }, { quantity: 1, pricePerUnit: 5 }] },
  result: { erpQuoteNumber: "A-77", kunde: { name: "Bergmann GmbH" }, positionen: [{ pos: 1 }, { pos: 2 }] },
  meta: { datum: "2026-07-21", userName: "Max Admin" },
};

describe("resolveFieldMapping", () => {
  it("resolves form, result and meta paths", () => {
    const out = resolveFieldMapping(
      { angebotsnummer: "$.result.erpQuoteNumber", notiz: "$.form.notes", datum: "$.meta.datum", name: "$.result.kunde.name" },
      context
    );
    expect(out).toEqual({ angebotsnummer: "A-77", notiz: "eilig", datum: "2026-07-21", name: "Bergmann GmbH" });
  });

  it("treats non-path strings as literals", () => {
    const out = resolveFieldMapping({ zahlungsart: "Rechnung" }, context);
    expect(out["zahlungsart"]).toBe("Rechnung");
  });

  it("passes arrays through with [*]", () => {
    const out = resolveFieldMapping({ positionen: "$.result.positionen[*]" }, context);
    expect(out["positionen"]).toEqual([{ pos: 1 }, { pos: 2 }]);
  });

  it("maps array items with itemMapping incl. $pos", () => {
    const out = resolveFieldMapping(
      { positionen: { path: "$.form.lineItems[*]", itemMapping: { pos: "$pos", menge: "$.quantity", einheit: "ST" } } },
      context
    );
    expect(out["positionen"]).toEqual([
      { pos: 1, menge: 2, einheit: "ST" },
      { pos: 2, menge: 1, einheit: "ST" },
    ]);
  });

  it("yields undefined for unknown paths and empty array for non-arrays", () => {
    const out = resolveFieldMapping({ x: "$.result.gibtEsNicht", y: "$.form.notes[*]" }, context);
    expect(out["x"]).toBeUndefined();
    expect(out["y"]).toEqual([]);
  });
});
