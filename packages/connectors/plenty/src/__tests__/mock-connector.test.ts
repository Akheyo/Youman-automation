import { describe, expect, it } from "vitest";
import { PlentyMockConnector } from "../adapters/PlentyMockConnector";
import { NotFoundError, NotSupportedError } from "../errors";
import type { QuoteDraft } from "@youman/shared";

const connector = new PlentyMockConnector("tenant-1");

const draft: QuoteDraft = {
  id: "draft-1",
  tenantId: "tenant-1",
  userId: "user-1",
  customerId: "118",
  customerNumber: "118",
  customerName: "Bergmann Handels GmbH",
  currency: "EUR",
  lineItems: [
    {
      position: 1, productId: "1101", articleNumber: "TRK-500-BLK",
      designation: "Trekkingrucksack Fjell 50 L schwarz", quantity: 2, unit: "ST",
      pricePerUnit: 74.9, netTotal: 149.8, grossTotal: 178.26, currency: "EUR",
    },
  ],
  totalNet: 149.8,
  totalGross: 178.26,
  status: "draft",
  createdAt: "2026-07-21T10:00:00Z",
  updatedAt: "2026-07-21T10:00:00Z",
};

describe("PlentyMockConnector", () => {
  it("reports healthy", async () => {
    const health = await connector.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("searches customers by name, number and email", async () => {
    expect((await connector.searchCustomers({ query: "bergmann" })).items).toHaveLength(1);
    expect((await connector.searchCustomers({ query: "119" })).items[0]!.name).toBe("Feinkost Lindner e.K.");
    expect((await connector.searchCustomers({ query: "purchasing@nordlicht" })).items[0]!.id).toBe("120");
    expect((await connector.searchCustomers({ query: "gibtsnicht" })).items).toHaveLength(0);
  });

  it("stamps the tenant id onto returned customers", async () => {
    const { items } = await connector.searchCustomers({ query: "bergmann" });
    expect(items[0]!.tenantId).toBe("tenant-1");
    expect(items[0]!.source).toBe("PLENTY");
  });

  it("gets a customer and its addresses", async () => {
    const customer = await connector.getCustomer("118");
    expect(customer.name).toBe("Bergmann Handels GmbH");
    const addresses = await connector.getCustomerAddresses("118");
    expect(addresses).toHaveLength(2);
    expect(addresses.map((a) => a.type)).toEqual(["billing", "shipping"]);
  });

  it("throws NotFoundError for unknown customers", async () => {
    await expect(connector.getCustomer("999")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a customer with addresses", async () => {
    const created = await connector.createCustomer({
      tenantId: "tenant-1", customerNumber: "", name: "Neue Firma GmbH", email: "hallo@neuefirma.de",
      currency: "EUR", isActive: true, source: "PLENTY",
      addresses: [{ id: "", type: "billing", street: "Teststraße", zip: "12345", city: "Teststadt", countryCode: "DE", isDefault: true }],
    });
    expect(created.id).not.toBe("");
    expect(created.externalId).toMatch(/^K-2026-/);
    expect(created.addresses[0]!.id).not.toBe("");
  });

  it("updates a customer", async () => {
    const updated = await connector.updateCustomer("119", { name: "Feinkost Lindner GmbH" });
    expect(updated.name).toBe("Feinkost Lindner GmbH");
    expect(updated.id).toBe("119");
  });

  it("creates a customer address", async () => {
    const addr = await connector.createCustomerAddress("120", {
      type: "shipping", street: "Neuer Weg", zip: "24106", city: "Kiel", countryCode: "DE", isDefault: false,
    });
    expect(addr.id).not.toBe("");
    expect(addr.type).toBe("shipping");
  });

  it("searches products by name, SKU and EAN", async () => {
    expect((await connector.searchProducts({ query: "trekking" })).items).toHaveLength(2);
    expect((await connector.searchProducts({ query: "ISO-750-EDST" })).items[0]!.id).toBe("2205");
    expect((await connector.searchProducts({ query: "4012345678905" })).items[0]!.id).toBe("3310");
  });

  it("finds products by exact numeric id (offline demo of the id search)", async () => {
    const result = await connector.searchProducts({ query: "2205" });
    expect(result.items[0]!.id).toBe("2205");
    expect(result.items[0]!.designation).toContain("Isolierflasche");
  });

  it("returns variation-shaped products with price and stock", async () => {
    const product = await connector.getProduct("1101");
    expect(product.articleNumber).toBe("TRK-500-BLK");
    expect(product.basePrice).toBe(74.9);
    expect(product.stockInfo?.available).toBe(142);
  });

  it("returns stock info and filters by warehouse", async () => {
    const stock = await connector.getProductStock("2205");
    expect(stock[0]!.warehouseId).toBe("2");
    expect(await connector.getProductStock("2205", "99")).toHaveLength(0);
  });

  it("returns price info with German VAT", async () => {
    const price = await connector.getProductPrice("2205", undefined, 3);
    expect(price.netPrice).toBe(21.5);
    expect(price.grossPrice).toBeCloseTo(25.58, 2);
    expect(price.currency).toBe("EUR");
  });

  it("creates quotes and sales orders with sequential ids", async () => {
    const quote = await connector.createQuote(draft);
    const order = await connector.createSalesOrder(draft);
    expect(Number(order.erpOrderId)).toBe(Number(quote.erpQuoteId) + 1);
    expect(quote.status).toBe("created");
  });

  it("rejects orders for unknown variations", async () => {
    const bad: QuoteDraft = { ...draft, lineItems: [{ ...draft.lineItems[0]!, productId: "0000" }] };
    await expect(connector.createQuote(bad)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotSupportedError for unsupported operations", async () => {
    await expect(connector.createProduct()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.reserveStock()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.createFollowUpTask()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.createAppointment()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.createNote()).rejects.toBeInstanceOf(NotSupportedError);
  });
});
