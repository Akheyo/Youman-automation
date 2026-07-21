import { describe, expect, it } from "vitest";
import { CreateQuoteSchema } from "@youman/shared";

/**
 * Reproduces the exact payload the desktop form sends for the minimal case
 * (customer + one line item + currency); FormBuilder emits explicit `null`
 * for empty optional fields and "YYYY-MM-DD" for date inputs.
 */
const MINIMAL_FORM_PAYLOAD = {
  customerId: "118",
  deliveryAddressId: null,
  currency: "EUR",
  validUntil: null,
  notes: null,
  lineItems: [
    {
      productId: "54721",
      articleNumber: "BEE 0020366180",
      designation: "Federbein",
      quantity: 1,
      unit: "ST",
      pricePerUnit: 199.9,
      discount: 0,
      deliveryDate: "", // empty date input
      notes: "",
    },
  ],
};

describe("CreateQuoteSchema – minimal form payload", () => {
  it("accepts the minimal payload that previously failed (null optionals, empty date)", () => {
    const parsed = CreateQuoteSchema.parse(MINIMAL_FORM_PAYLOAD);
    expect(parsed.customerId).toBe("118");
    expect(parsed.currency).toBe("EUR");
    expect(parsed.lineItems).toHaveLength(1);
    // null/"" optionals are normalized to undefined, not rejected.
    expect(parsed.deliveryAddressId).toBeUndefined();
    expect(parsed.validUntil).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
    expect(parsed.customerNumber).toBeUndefined();
    expect(parsed.customerName).toBeUndefined();
    expect(parsed.lineItems[0]!.deliveryDate).toBeUndefined();
  });

  it("accepts a date-only 'gültig bis' from <input type=date>", () => {
    const parsed = CreateQuoteSchema.parse({ ...MINIMAL_FORM_PAYLOAD, validUntil: "2026-08-30" });
    expect(parsed.validUntil).toBe("2026-08-30");
  });

  it("still accepts full ISO datetimes", () => {
    const parsed = CreateQuoteSchema.parse({ ...MINIMAL_FORM_PAYLOAD, validUntil: "2026-08-30T12:00:00Z" });
    expect(parsed.validUntil).toBe("2026-08-30T12:00:00Z");
  });

  it("still rejects the true essentials (no customer, empty positions, non-positive qty)", () => {
    expect(() => CreateQuoteSchema.parse({ ...MINIMAL_FORM_PAYLOAD, customerId: "" })).toThrow();
    expect(() => CreateQuoteSchema.parse({ ...MINIMAL_FORM_PAYLOAD, lineItems: [] })).toThrow();
    expect(() =>
      CreateQuoteSchema.parse({
        ...MINIMAL_FORM_PAYLOAD,
        lineItems: [{ ...MINIMAL_FORM_PAYLOAD.lineItems[0], quantity: 0 }],
      })
    ).toThrow();
  });
});
