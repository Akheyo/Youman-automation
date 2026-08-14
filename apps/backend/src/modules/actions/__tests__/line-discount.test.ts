import { describe, expect, it } from "vitest";
import { withoutLineDiscount } from "../actions.service";
import { CreateQuoteSchema } from "@youman/shared";

const CONFIG = {
  id: "action-create-quote",
  fields: [
    { key: "customerId", type: "searchable_select" },
    {
      key: "lineItems",
      type: "table_line_items",
      lineItemColumns: [
        { key: "productId", label: "Artikel" },
        { key: "quantity", label: "Menge" },
        { key: "pricePerUnit", label: "Einzelpreis" },
        { key: "discount", label: "Rabatt %" },
        { key: "deliveryDate", label: "Lieferdatum" },
      ],
    },
  ],
};

describe("withoutLineDiscount", () => {
  it("removes the discount column and keeps the rest in order", () => {
    const result = withoutLineDiscount(CONFIG) as typeof CONFIG;
    const keys = result.fields[1]!.lineItemColumns!.map((c) => c.key);
    expect(keys).toEqual(["productId", "quantity", "pricePerUnit", "deliveryDate"]);
  });

  it("does not modify the original definition", () => {
    withoutLineDiscount(CONFIG);
    // Die Definition kommt aus der Datenbank und gilt für alle Mandanten –
    // sie darf durch die Mandanten-Einstellung nicht verändert werden.
    expect(CONFIG.fields[1]!.lineItemColumns!.map((c) => c.key)).toContain("discount");
  });

  it("returns the same object when there is nothing to strip", () => {
    const plain = { id: "x", fields: [{ key: "notes", type: "textarea" }] };
    expect(withoutLineDiscount(plain)).toBe(plain);
  });

  it("survives definitions of an unexpected shape", () => {
    expect(withoutLineDiscount(null)).toBeNull();
    expect(withoutLineDiscount("kaputt")).toBe("kaputt");
    expect(withoutLineDiscount({ fields: "keine Liste" })).toEqual({ fields: "keine Liste" });
    expect(withoutLineDiscount({ fields: [null, 42] })).toEqual({ fields: [null, 42] });
  });
});

describe("negative line prices", () => {
  const base = {
    customerId: "17968",
    currency: "EUR",
    lineItems: [
      { productId: "1", quantity: 1, unit: "ST", pricePerUnit: 1000 },
      // Rabatt als eigene Artikelposition mit Minusbetrag.
      { productId: "99999", quantity: 1, unit: "ST", pricePerUnit: -150 },
    ],
  };

  it("accepts a discount position with a negative price", () => {
    const parsed = CreateQuoteSchema.parse(base);
    expect(parsed.lineItems[1]!.pricePerUnit).toBe(-150);
  });

  it("still rejects a non-numeric or infinite price", () => {
    expect(() =>
      CreateQuoteSchema.parse({
        ...base,
        lineItems: [{ productId: "1", quantity: 1, unit: "ST", pricePerUnit: Number.POSITIVE_INFINITY }],
      })
    ).toThrow();
  });

  it("still requires a positive quantity", () => {
    expect(() =>
      CreateQuoteSchema.parse({
        ...base,
        lineItems: [{ productId: "1", quantity: -1, unit: "ST", pricePerUnit: 10 }],
      })
    ).toThrow();
  });
});
