import { describe, expect, it, vi } from "vitest";
import { PlentyConnector, normalizeBaseUrl } from "../adapters/PlentyConnector";
import type { PlentyHttpClient } from "../http/PlentyHttpClient";
import { NotSupportedError, ValidationError } from "../errors";
import { contactSearchResponse, orderCreateResponse, variationSearchResponse } from "./fixtures";
import type { QuoteDraft } from "@youman/shared";
import type { PlentyConfig } from "../types/PlentyConfig";

const CONFIG: PlentyConfig = {
  baseUrl: "https://demo.my.plentysystems.com",
  username: "api-user",
  password: "secret",
  plentyId: 1000,
};

interface HttpStub {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

function connectorWithStub(): { connector: PlentyConnector; http: HttpStub } {
  const http: HttpStub = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
  const connector = new PlentyConnector("tenant-1", CONFIG, {
    httpClient: http as unknown as PlentyHttpClient,
  });
  return { connector, http };
}

describe("PlentyConnector configuration", () => {
  it("rejects incomplete configs with a ValidationError", () => {
    expect(() => new PlentyConnector("t", { baseUrl: "x" } as PlentyConfig)).toThrowError(ValidationError);
  });

  it("normalizes the base URL to end with /rest", () => {
    expect(normalizeBaseUrl("https://demo.my.plentysystems.com")).toBe("https://demo.my.plentysystems.com/rest");
    expect(normalizeBaseUrl("https://demo.my.plentysystems.com/rest/")).toBe("https://demo.my.plentysystems.com/rest");
  });
});

describe("PlentyConnector customer search heuristics", () => {
  it("searches by email when the query contains an @", async () => {
    const { connector, http } = connectorWithStub();
    http.get.mockResolvedValue(contactSearchResponse);

    await connector.searchCustomers({ query: "einkauf@bergmann-handel.de" });
    expect(http.get).toHaveBeenCalledWith(
      "/accounts/contacts",
      expect.objectContaining({ email: "einkauf@bergmann-handel.de" })
    );
  });

  it("uses Plenty full-text search for non-email queries", async () => {
    const { connector, http } = connectorWithStub();
    http.get.mockResolvedValue(contactSearchResponse);

    await connector.searchCustomers({ query: "118" });
    expect(http.get).toHaveBeenLastCalledWith("/accounts/contacts", expect.objectContaining({ fullText: "118" }));

    await connector.searchCustomers({ query: "Bergmann" });
    expect(http.get).toHaveBeenLastCalledWith("/accounts/contacts", expect.objectContaining({ fullText: "Bergmann" }));
  });

  it("maps paged results including hasMore", async () => {
    const { connector, http } = connectorWithStub();
    http.get.mockResolvedValue({ ...contactSearchResponse, isLastPage: false, totalsCount: 57 });

    const result = await connector.searchCustomers({ query: "a", page: 1, pageSize: 20 });
    expect(result.total).toBe(57);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]!.name).toBe("Bergmann Handels GmbH");
  });
});

describe("PlentyConnector product search heuristics", () => {
  it("uses barcode search for EAN-like queries", async () => {
    const { connector, http } = connectorWithStub();
    http.get.mockResolvedValue(variationSearchResponse);

    await connector.searchProducts({ query: "4260123456789" });
    expect(http.get).toHaveBeenCalledWith("/items/variations", expect.objectContaining({ barcode: "4260123456789" }));
  });

  it("tries the variation number first for compact queries, falling back to itemName", async () => {
    const { connector, http } = connectorWithStub();
    http.get
      .mockResolvedValueOnce({ ...variationSearchResponse, entries: [], totalsCount: 0 })
      .mockResolvedValueOnce(variationSearchResponse);

    const result = await connector.searchProducts({ query: "Fjell" });
    expect(http.get).toHaveBeenNthCalledWith(1, "/items/variations", expect.objectContaining({ numberFuzzy: "Fjell" }));
    expect(http.get).toHaveBeenNthCalledWith(2, "/items/variations", expect.objectContaining({ itemName: "Fjell" }));
    expect(result.items[0]!.articleNumber).toBe("TRK-500-BLK");
  });

  it("chains number → variation id → item id for numeric queries", async () => {
    const { connector, http } = connectorWithStub();
    // Fixture variation: id 1101, itemId 210 → the itemId step must match.
    http.get
      .mockResolvedValueOnce({ ...variationSearchResponse, entries: [], totalsCount: 0 })
      .mockResolvedValueOnce({ ...variationSearchResponse, entries: [], totalsCount: 0 })
      .mockResolvedValueOnce(variationSearchResponse);

    const result = await connector.searchProducts({ query: "210" });
    expect(http.get).toHaveBeenNthCalledWith(1, "/items/variations", expect.objectContaining({ numberFuzzy: "210" }));
    expect(http.get).toHaveBeenNthCalledWith(2, "/items/variations", expect.objectContaining({ id: 210 }));
    expect(http.get).toHaveBeenNthCalledWith(3, "/items/variations", expect.objectContaining({ itemId: 210 }));
    expect(result.items).toHaveLength(1);
  });

  it("drops id/itemId hits that do not match the filter and falls back to itemName", async () => {
    const { connector, http } = connectorWithStub();
    // Plenty ignores the filter and returns unrelated entries (id 1101/itemId 210
    // for query 54752) → both id steps must be discarded, itemName wins.
    http.get
      .mockResolvedValueOnce({ ...variationSearchResponse, entries: [], totalsCount: 0 })
      .mockResolvedValueOnce(variationSearchResponse)
      .mockResolvedValueOnce(variationSearchResponse)
      .mockResolvedValueOnce(variationSearchResponse);

    const result = await connector.searchProducts({ query: "54752" });
    expect(http.get).toHaveBeenNthCalledWith(4, "/items/variations", expect.objectContaining({ itemName: "54752" }));
    expect(result.items).toHaveLength(1);
  });

  it("continues the fallback chain when a single search mode fails", async () => {
    const { connector, http } = connectorWithStub();
    http.get
      .mockRejectedValueOnce(new Error("Plenty-Request ungültig (HTTP 400)"))
      .mockResolvedValueOnce({ ...variationSearchResponse, entries: [], totalsCount: 0 })
      .mockResolvedValueOnce(variationSearchResponse);

    const result = await connector.searchProducts({ query: "210" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.articleNumber).toBe("TRK-500-BLK");
  });

  it("searches by itemName for queries containing whitespace", async () => {
    const { connector, http } = connectorWithStub();
    http.get.mockResolvedValue(variationSearchResponse);

    await connector.searchProducts({ query: "Trekkingrucksack Fjell" });
    expect(http.get).toHaveBeenCalledWith("/items/variations", expect.objectContaining({ itemName: "Trekkingrucksack Fjell" }));
  });
});

describe("PlentyConnector orders", () => {
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

  it("creates a quote as Plenty order typeId 4 with contact relation and address relations", async () => {
    const { connector, http } = connectorWithStub();
    http.get.mockResolvedValue(contactSearchResponse.entries[0]!.addresses);
    http.post.mockResolvedValue(orderCreateResponse);

    const result = await connector.createQuote(draft);
    expect(result.erpQuoteId).toBe("5231");

    const [url, payload] = http.post.mock.calls[0]! as [string, Record<string, unknown>];
    expect(url).toBe("/orders");
    expect(payload["typeId"]).toBe(4);
    expect(payload["plentyId"]).toBe(1000);
    expect(payload["relations"]).toEqual([{ referenceType: "contact", referenceId: 118, relation: "receiver" }]);
    expect(payload["addressRelations"]).toEqual([
      { typeId: 1, addressId: 301 },
      { typeId: 2, addressId: 302 },
    ]);
  });

  it("creates a sales order as typeId 1 and honors the draft delivery address", async () => {
    const { connector, http } = connectorWithStub();
    http.get.mockResolvedValue(contactSearchResponse.entries[0]!.addresses);
    http.post.mockResolvedValue({ ...orderCreateResponse, typeId: 1 });

    await connector.createSalesOrder({ ...draft, deliveryAddressId: "777" });
    const [, payload] = http.post.mock.calls[0]! as [string, Record<string, unknown>];
    expect(payload["typeId"]).toBe(1);
    expect(payload["addressRelations"]).toContainEqual({ typeId: 2, addressId: 777 });
  });
});

describe("PlentyConnector unsupported operations", () => {
  it("throws NotSupportedError for operations without a Plenty equivalent", async () => {
    const { connector } = connectorWithStub();
    await expect(connector.createProduct()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.reserveStock()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.createFollowUpTask()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.createAppointment()).rejects.toBeInstanceOf(NotSupportedError);
    await expect(connector.createNote()).rejects.toBeInstanceOf(NotSupportedError);
  });
});
