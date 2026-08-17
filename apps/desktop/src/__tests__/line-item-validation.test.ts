import { describe, expect, it } from "vitest";
import { validateLineItems } from "@/components/screens/ActionScreen";
import type { ActionDefinition } from "@youman/shared";

/** Aktionsdefinition mit denselben Pflichtspalten wie das Angebotsformular. */
const ACTION = {
  id: "action-create-quote",
  fields: [
    {
      key: "lineItems",
      type: "table_line_items",
      lineItemColumns: [
        { key: "productId", label: "Artikel-ID", type: "searchable_select", required: true },
        { key: "designation", label: "Bezeichnung", type: "text", required: false },
        { key: "quantity", label: "Menge", type: "number", required: true },
        { key: "pricePerUnit", label: "Einzelpreis", type: "number", required: true },
      ],
    },
  ],
} as unknown as ActionDefinition;

const row = (over: Record<string, unknown> = {}) => ({
  productId: "55180",
  quantity: 1,
  pricePerUnit: 419.33,
  ...over,
});

describe("validateLineItems", () => {
  it("accepts a discount position with a negative unit price", () => {
    // Der eigentliche Fall: Amikon führt den Rabatt als Artikelposition mit
    // Minusbetrag. Eine Prüfung auf "> 0" wies das Angebot ab, obwohl der
    // Server es annimmt.
    const payload = { lineItems: [row(), row({ productId: "99001", pricePerUnit: -40 })] };
    expect(validateLineItems(ACTION, payload)).toBeNull();
  });

  it("accepts a price of zero (free item)", () => {
    expect(validateLineItems(ACTION, { lineItems: [row({ pricePerUnit: 0 })] })).toBeNull();
  });

  it("still rejects a quantity of zero or less", () => {
    expect(validateLineItems(ACTION, { lineItems: [row({ quantity: 0 })] })).toBe(
      "Position 1: Menge muss größer als 0 sein."
    );
    expect(validateLineItems(ACTION, { lineItems: [row({ quantity: -1 })] })).toBe(
      "Position 1: Menge muss größer als 0 sein."
    );
  });

  it("rejects a missing or non-numeric price", () => {
    expect(validateLineItems(ACTION, { lineItems: [row({ pricePerUnit: undefined })] })).toBe(
      "Position 1: Einzelpreis fehlt oder ist keine Zahl."
    );
    expect(validateLineItems(ACTION, { lineItems: [row({ pricePerUnit: Number.NaN })] })).toBe(
      "Position 1: Einzelpreis fehlt oder ist keine Zahl."
    );
    expect(validateLineItems(ACTION, { lineItems: [row({ pricePerUnit: "40" })] })).toBe(
      "Position 1: Einzelpreis fehlt oder ist keine Zahl."
    );
  });

  it("names the offending row", () => {
    const payload = { lineItems: [row(), row({ quantity: 0 })] };
    expect(validateLineItems(ACTION, payload)).toBe("Position 2: Menge muss größer als 0 sein.");
  });

  it("still requires an article and at least one row", () => {
    expect(validateLineItems(ACTION, { lineItems: [row({ productId: "" })] })).toContain(
      "Bitte einen Artikel auswählen"
    );
    expect(validateLineItems(ACTION, { lineItems: [] })).toBe("Bitte mindestens eine Position hinzufügen.");
  });
});
