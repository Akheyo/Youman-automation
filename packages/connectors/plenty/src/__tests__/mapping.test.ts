import { describe, expect, it } from "vitest";
import {
  buildAddressPayload,
  buildContactPayload,
  buildOrderPayload,
  mapContactToCustomer,
  mapPlentyAddress,
  mapVariationToProduct,
  pickDefaultSalesPrice,
  ORDER_TYPE_OFFER,
} from "../mapping";
import { toValidationError } from "../errors";
import { contactSearchResponse, orderCreateResponse, validationErrorBody, variationSearchResponse } from "./fixtures";
import type { QuoteDraft } from "@youman/shared";

const TENANT = "tenant-1";

describe("mapContactToCustomer", () => {
  it("maps a full contact including options and addresses", () => {
    const customer = mapContactToCustomer(contactSearchResponse.entries[0]!, TENANT);
    expect(customer.id).toBe("118");
    expect(customer.externalId).toBe("K-2024-118");
    expect(customer.customerNumber).toBe("118");
    expect(customer.name).toBe("Bergmann Handels GmbH");
    expect(customer.email).toBe("einkauf@bergmann-handel.de");
    expect(customer.phone).toBe("+49 221 4780-0");
    expect(customer.mobile).toBe("+49 170 1122334");
    expect(customer.tenantId).toBe(TENANT);
    expect(customer.source).toBe("PLENTY");
    expect(customer.addresses).toHaveLength(2);
    expect(customer.addresses[0]!.type).toBe("billing");
    expect(customer.addresses[1]!.type).toBe("shipping");
  });

  it("falls back to first/last name and contact id when fullName/externalId are missing", () => {
    const customer = mapContactToCustomer(contactSearchResponse.entries[1]!, TENANT);
    expect(customer.name).toBe("Jana Lindner");
    expect(customer.externalId).toBe("119");
    expect(customer.mobile).toBeUndefined();
  });
});

describe("mapPlentyAddress", () => {
  it("maps street, house number, country and pivot type", () => {
    const addr = mapPlentyAddress(contactSearchResponse.entries[0]!.addresses![1]!);
    expect(addr).toMatchObject({
      id: "302",
      type: "shipping",
      street: "Gewerbepark Süd",
      streetNumber: "4a",
      zip: "51149",
      city: "Köln",
      countryCode: "DE",
      isDefault: false,
    });
  });
});

describe("mapVariationToProduct", () => {
  const variation = variationSearchResponse.entries[0]!;

  it("maps a variation to a product with EAN, price and stock", () => {
    const product = mapVariationToProduct(variation, TENANT, { currency: "EUR" });
    expect(product.id).toBe("1101");
    expect(product.articleNumber).toBe("TRK-500-BLK");
    expect(product.ean).toBe("4260123456789");
    expect(product.designation).toBe("50 L / schwarz");
    expect(product.basePrice).toBe(74.9); // lowest salesPriceId (1) wins
    expect(product.currency).toBe("EUR");
    expect(product.source).toBe("PLENTY");
    expect(product.stockInfo?.available).toBe(142);
    expect(product.stockInfo?.reserved).toBe(8);
  });

  it("prefers the configured default warehouse for stockInfo", () => {
    const product = mapVariationToProduct(variation, TENANT, { defaultWarehouseId: 2 });
    expect(product.stockInfo?.warehouseId).toBe("2");
    expect(product.stockInfo?.available).toBe(15);
  });

  it("falls back to the German itemTexts name when the variation has no own name", () => {
    const product = mapVariationToProduct({ ...variation, name: null }, TENANT);
    expect(product.designation).toBe("Trekkingrucksack Fjell 50 L");
  });

  it("maps the model as manufacturer article number", () => {
    const product = mapVariationToProduct(variation, TENANT);
    expect(product.manufacturerArticleNumber).toBe("FJ-50-001");
  });
});

describe("pickDefaultSalesPrice", () => {
  it("returns undefined without prices", () => {
    expect(pickDefaultSalesPrice({ id: 1, itemId: 1 })).toBeUndefined();
  });
});

describe("buildContactPayload", () => {
  it("creates typed contact options for email, phone and mobile", () => {
    const payload = buildContactPayload({
      tenantId: TENANT,
      customerNumber: "",
      name: "Testfirma GmbH",
      email: "info@testfirma.de",
      phone: "+49 30 1234",
      mobile: "+49 171 9876",
      currency: "EUR",
      isActive: true,
      source: "PLENTY",
      addresses: [],
    });
    expect(payload["typeId"]).toBe(1);
    // Firmenname geht in Plentys name1 (name2/name3 = Vor-/Nachname bei Personen).
    expect(payload["name1"]).toBe("Testfirma GmbH");
    const options = payload["options"] as Array<Record<string, unknown>>;
    expect(options).toHaveLength(3);
    expect(options[0]).toMatchObject({ typeId: 2, value: "info@testfirma.de" });
    expect(options[2]).toMatchObject({ typeId: 4, subTypeId: 2, value: "+49 171 9876" });
  });
});

describe("buildAddressPayload", () => {
  it("maps billing/shipping to Plenty typeId 1/2 and country codes to ids", () => {
    const billing = buildAddressPayload({
      type: "billing", street: "Hauptstraße", streetNumber: "1", zip: "10115", city: "Berlin", countryCode: "DE", isDefault: true,
    });
    expect(billing).toMatchObject({ typeId: 1, address1: "Hauptstraße", address2: "1", postalCode: "10115", town: "Berlin", countryId: 1 });

    const shipping = buildAddressPayload({
      type: "shipping", street: "Ringstraße", zip: "1010", city: "Wien", countryCode: "AT", isDefault: false,
    });
    expect(shipping).toMatchObject({ typeId: 2, countryId: 2 });
  });
});

describe("buildOrderPayload", () => {
  const draft: QuoteDraft = {
    id: "draft-1",
    tenantId: TENANT,
    userId: "user-1",
    customerId: "118",
    customerNumber: "118",
    customerName: "Bergmann Handels GmbH",
    currency: "EUR",
    lineItems: [
      {
        position: 1, productId: "1101", articleNumber: "TRK-500-BLK",
        designation: "Trekkingrucksack Fjell 50 L schwarz", quantity: 5, unit: "ST",
        pricePerUnit: 74.9, netTotal: 374.5, grossTotal: 445.66, currency: "EUR",
      },
    ],
    totalNet: 374.5,
    totalGross: 445.66,
    status: "draft",
    createdAt: "2026-07-21T10:00:00Z",
    updatedAt: "2026-07-21T10:00:00Z",
  };

  it("builds the Plenty order structure with typeId, plentyId, items, relations and addresses", () => {
    const payload = buildOrderPayload(draft, ORDER_TYPE_OFFER, { plentyId: 1000, defaultReferrerId: 1 }, { billingAddressId: 301, shippingAddressId: 302 });
    expect(payload["typeId"]).toBe(4);
    expect(payload["plentyId"]).toBe(1000);

    const items = payload["orderItems"] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ itemVariationId: 1101, quantity: 5, orderItemName: "Trekkingrucksack Fjell 50 L schwarz" });
    const amounts = items[0]!["amounts"] as Array<Record<string, unknown>>;
    expect(amounts[0]!["priceOriginalGross"]).toBeCloseTo(89.13, 2);
    expect(amounts[0]!["currency"]).toBe("EUR");

    expect(payload["relations"]).toEqual([{ referenceType: "contact", referenceId: 118, relation: "receiver" }]);
    expect(payload["addressRelations"]).toEqual([
      { typeId: 1, addressId: 301 },
      { typeId: 2, addressId: 302 },
    ]);
  });

  it("applies line discounts to the gross price and omits empty addressRelations", () => {
    const discounted: QuoteDraft = {
      ...draft,
      lineItems: [{ ...draft.lineItems[0]!, discount: 10 }],
    };
    const payload = buildOrderPayload(discounted, ORDER_TYPE_OFFER, { plentyId: 1000 });
    const items = payload["orderItems"] as Array<Record<string, unknown>>;
    const amounts = items[0]!["amounts"] as Array<Record<string, unknown>>;
    expect(amounts[0]!["priceOriginalGross"]).toBeCloseTo(80.22, 2);
    expect(payload["addressRelations"]).toBeUndefined();
  });

  it("round-trips against the realistic order response fixture", () => {
    expect(orderCreateResponse.typeId).toBe(ORDER_TYPE_OFFER);
    expect(String(orderCreateResponse.id)).toBe("5231");
  });
});

describe("toValidationError", () => {
  it("translates Plenty field-keyed validation errors into a readable message", () => {
    const err = toValidationError(validationErrorBody, "fallback");
    expect(err.fieldErrors["typeId"]).toEqual(["The type id field is required."]);
    expect(err.fieldErrors["plentyId"]).toEqual(["The plenty id field is required."]);
    expect(err.message).toContain("typeId: The type id field is required.");
    expect(err.message).toContain("orderItems.0.itemVariationId");
  });

  it("uses the fallback message for unknown bodies", () => {
    const err = toValidationError("boom", "fallback");
    expect(err.message).toBe("fallback");
    expect(err.fieldErrors).toEqual({});
  });
});
