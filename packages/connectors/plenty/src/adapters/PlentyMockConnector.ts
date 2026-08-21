import type {
  Address,
  Country,
  Appointment,
  Customer,
  FollowUpTask,
  Note,
  PriceInfo,
  Product,
  QuoteDraft,
  SearchRequest,
  SearchResult,
  StockInfo,
} from "@youman/shared";
import type {
  ConnectorHealthResult,
  IErpConnector,
  OrderResult,
  QuoteResult,
  ReservationResult,
} from "@youman/connector-sap";
import { NotFoundError, NotSupportedError } from "../errors";

/**
 * Mock adapter for the Plentymarkets connector – same data shapes as the real
 * PlentyConnector (variation-based products, contact-based customers), fully
 * offline. Latency simulation can be disabled for fast tests.
 */
export class PlentyMockConnector implements IErpConnector {
  readonly connectorType = "PLENTY";
  readonly tenantId: string;

  private readonly simulateLatency: boolean;
  private orderSeq = 4200;

  private static readonly CUSTOMERS: Customer[] = [
    {
      id: "118", externalId: "K-2024-118", tenantId: "", customerNumber: "118",
      name: "Bergmann Handels GmbH", email: "einkauf@bergmann-handel.de", phone: "+49 221 4780-0",
      currency: "EUR", isActive: true, source: "PLENTY",
      addresses: [
        { id: "301", type: "billing", street: "Deutzer Freiheit", streetNumber: "72", zip: "50679", city: "Köln", countryCode: "DE", isDefault: true },
        { id: "302", type: "shipping", street: "Gewerbepark Süd", streetNumber: "4a", zip: "51149", city: "Köln", countryCode: "DE", isDefault: false },
      ],
      createdAt: "2024-03-11T09:20:00Z", updatedAt: "2025-11-02T14:05:00Z",
    },
    {
      id: "119", externalId: "K-2024-119", tenantId: "", customerNumber: "119",
      name: "Feinkost Lindner e.K.", email: "bestellung@feinkost-lindner.de", phone: "+49 911 302218", mobile: "+49 171 5556677",
      currency: "EUR", isActive: true, source: "PLENTY",
      addresses: [
        { id: "310", type: "billing", street: "Königstraße", streetNumber: "15", zip: "90402", city: "Nürnberg", countryCode: "DE", isDefault: true },
      ],
      createdAt: "2024-05-27T11:40:00Z", updatedAt: "2025-10-19T08:12:00Z",
    },
    {
      id: "120", externalId: "K-2025-120", tenantId: "", customerNumber: "120",
      name: "Nordlicht Outdoor AG", email: "purchasing@nordlicht-outdoor.de", phone: "+49 431 88 44 22",
      currency: "EUR", isActive: true, source: "PLENTY",
      addresses: [
        { id: "320", type: "billing", street: "Hafenstraße", streetNumber: "9", zip: "24103", city: "Kiel", countryCode: "DE", isDefault: true },
        { id: "321", type: "shipping", street: "Logistikweg", streetNumber: "12", zip: "24145", city: "Kiel", countryCode: "DE", isDefault: false },
      ],
      createdAt: "2025-01-08T07:55:00Z", updatedAt: "2025-12-01T16:30:00Z",
    },
  ];

  private static readonly PRODUCTS: Product[] = [
    {
      id: "1101", externalId: "1101", tenantId: "", articleNumber: "21001",
      ean: "4260123456789", designation: "Trekkingrucksack Fjell 50 L schwarz",
      description: "Wasserabweisender Trekkingrucksack mit Alu-Rahmen", manufacturer: "Nordkamm",
      unit: "ST", basePrice: 74.9, currency: "EUR", taxClass: "STANDARD", isActive: true, source: "PLENTY",
      stockInfo: { productId: "1101", warehouseId: "1", warehouseName: "Lager 1", available: 142, reserved: 8, onOrder: 0, total: 150, unit: "ST", updatedAt: "2025-12-15T06:00:00Z" },
      createdAt: "2024-02-01T10:00:00Z", updatedAt: "2025-12-15T06:00:00Z",
    },
    {
      id: "1102", externalId: "1102", tenantId: "", articleNumber: "21002",
      ean: "4260123456796", designation: "Trekkingrucksack Fjell 50 L oliv",
      manufacturer: "Nordkamm",
      unit: "ST", basePrice: 74.9, currency: "EUR", taxClass: "STANDARD", isActive: true, source: "PLENTY",
      stockInfo: { productId: "1102", warehouseId: "1", warehouseName: "Lager 1", available: 37, reserved: 2, onOrder: 0, total: 39, unit: "ST", updatedAt: "2025-12-15T06:00:00Z" },
      createdAt: "2024-02-01T10:00:00Z", updatedAt: "2025-12-15T06:00:00Z",
    },
    {
      id: "2205", externalId: "2205", tenantId: "", articleNumber: "22050",
      ean: "4009876543210", designation: "Isolierflasche Polar 750 ml Edelstahl",
      manufacturer: "Thermaris",
      unit: "ST", basePrice: 21.5, currency: "EUR", taxClass: "STANDARD", isActive: true, source: "PLENTY",
      stockInfo: { productId: "2205", warehouseId: "2", warehouseName: "Lager 2", available: 480, reserved: 25, onOrder: 200, total: 505, unit: "ST", updatedAt: "2025-12-15T06:00:00Z" },
      createdAt: "2024-06-14T08:30:00Z", updatedAt: "2025-12-15T06:00:00Z",
    },
    {
      id: "3310", externalId: "3310", tenantId: "", articleNumber: "33100",
      ean: "4012345678905", designation: "Kuppelzelt Lofoten 2 Personen grün",
      manufacturer: "Nordkamm",
      unit: "ST", basePrice: 129.0, currency: "EUR", taxClass: "STANDARD", isActive: true, source: "PLENTY",
      stockInfo: { productId: "3310", warehouseId: "1", warehouseName: "Lager 1", available: 12, reserved: 1, onOrder: 40, total: 13, unit: "ST", updatedAt: "2025-12-15T06:00:00Z" },
      createdAt: "2024-09-03T13:10:00Z", updatedAt: "2025-12-15T06:00:00Z",
    },
  ];

  constructor(tenantId: string, opts: { simulateLatency?: boolean } = {}) {
    this.tenantId = tenantId;
    this.simulateLatency = opts.simulateLatency ?? false;
  }

  private async delay(ms: number): Promise<void> {
    if (this.simulateLatency) await new Promise((r) => setTimeout(r, ms));
  }

  async healthCheck(): Promise<ConnectorHealthResult> {
    await this.delay(40);
    return { healthy: true, latencyMs: 40, message: "Plenty-Mock – immer erreichbar" };
  }

  // ─── Customers ──────────────────────────────────────────────────────────────

  async searchCustomers(req: SearchRequest): Promise<SearchResult<Customer>> {
    await this.delay(150);
    const q = req.query.trim().toLowerCase();
    const items = PlentyMockConnector.CUSTOMERS.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.customerNumber.includes(q) ||
        c.externalId.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    ).map((c) => ({ ...c, tenantId: this.tenantId }));
    return { items, total: items.length, page: req.page ?? 1, pageSize: req.pageSize ?? 20, hasMore: false, searchDurationMs: 150 };
  }

  async getCustomer(id: string): Promise<Customer> {
    await this.delay(80);
    const c = PlentyMockConnector.CUSTOMERS.find((c) => c.id === id);
    if (!c) throw new NotFoundError(`Plenty-Kontakt '${id}' nicht gefunden`);
    return { ...c, tenantId: this.tenantId };
  }

  async createCustomer(data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Customer> {
    await this.delay(250);
    const id = String(200 + PlentyMockConnector.CUSTOMERS.length);
    return {
      ...data,
      id,
      externalId: `K-2026-${id}`,
      customerNumber: id,
      tenantId: this.tenantId,
      source: "PLENTY",
      addresses: (data.addresses ?? []).map((a, i) => ({ ...a, id: String(400 + i) })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    await this.delay(200);
    const c = await this.getCustomer(id);
    return { ...c, ...data, id: c.id, updatedAt: new Date().toISOString() };
  }

  /** Kleiner Ausschnitt – der Mock soll die Auswahl zeigen, nicht Plenty ersetzen. */
  async getCountries(): Promise<Country[]> {
    return [
      { code: "DE", name: "Deutschland", externalId: "1" },
      { code: "AT", name: "Österreich", externalId: "2" },
      { code: "CH", name: "Schweiz", externalId: "4" },
      { code: "NL", name: "Niederlande", externalId: "22" },
      { code: "PL", name: "Polen", externalId: "24" },
    ];
  }

  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    await this.delay(100);
    const c = await this.getCustomer(customerId);
    return c.addresses;
  }

  async createCustomerAddress(customerId: string, address: Omit<Address, "id">): Promise<Address> {
    await this.delay(200);
    await this.getCustomer(customerId); // validates existence
    return { ...address, id: String(500 + Math.floor(Math.random() * 400)) };
  }

  // ─── Products ───────────────────────────────────────────────────────────────

  async searchProducts(req: SearchRequest): Promise<SearchResult<Product>> {
    await this.delay(150);
    const q = req.query.trim().toLowerCase();
    // Mirrors the real connector's multi-track behaviour: numeric queries also
    // match the variation id / item id exactly, with exact-ID hits first.
    const exactIdHits = /^\d+$/.test(q)
      ? PlentyMockConnector.PRODUCTS.filter((p) => p.id === q || p.externalId === q)
      : [];
    const textHits = PlentyMockConnector.PRODUCTS.filter(
      (p) =>
        !q ||
        p.designation.toLowerCase().includes(q) ||
        p.articleNumber.toLowerCase().includes(q) ||
        p.ean?.includes(q) ||
        p.manufacturer?.toLowerCase().includes(q)
    );
    const seen = new Set<string>();
    const items = [...exactIdHits, ...textHits]
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .map((p) => ({ ...p, tenantId: this.tenantId }));
    return { items, total: items.length, page: req.page ?? 1, pageSize: req.pageSize ?? 20, hasMore: false, searchDurationMs: 150 };
  }

  async getProduct(id: string): Promise<Product> {
    await this.delay(80);
    const p = PlentyMockConnector.PRODUCTS.find((p) => p.id === id);
    if (!p) throw new NotFoundError(`Plenty-Variante '${id}' nicht gefunden`);
    return { ...p, tenantId: this.tenantId };
  }

  async createProduct(): Promise<Product> {
    throw new NotSupportedError(
      "createProduct",
      "Artikel-Anlage in Plentymarkets ist ein mehrstufiger Prozess (Item + Variante + Texte + Preise) und wird über die Plenty-Oberfläche gepflegt"
    );
  }

  async getProductStock(productId: string, warehouseId?: string): Promise<StockInfo[]> {
    await this.delay(100);
    const p = await this.getProduct(productId);
    const stock = p.stockInfo ? [p.stockInfo] : [];
    return warehouseId !== undefined ? stock.filter((s) => s.warehouseId === warehouseId) : stock;
  }

  async getProductPrice(productId: string, _customerId?: string, quantity = 1): Promise<PriceInfo> {
    await this.delay(80);
    const p = await this.getProduct(productId);
    return {
      productId,
      quantity,
      netPrice: p.basePrice,
      grossPrice: Math.round(p.basePrice * 1.19 * 100) / 100,
      currency: "EUR",
    };
  }

  // ─── Quotes / Orders ────────────────────────────────────────────────────────

  async createQuote(draft: QuoteDraft): Promise<QuoteResult> {
    await this.delay(300);
    this.assertLineItems(draft);
    const id = String(++this.orderSeq);
    return { erpQuoteId: id, erpQuoteNumber: id, status: "created", createdAt: new Date().toISOString() };
  }

  async createSalesOrder(draft: QuoteDraft): Promise<OrderResult> {
    await this.delay(300);
    this.assertLineItems(draft);
    const id = String(++this.orderSeq);
    return { erpOrderId: id, erpOrderNumber: id, status: "created", createdAt: new Date().toISOString() };
  }

  private assertLineItems(draft: QuoteDraft): void {
    for (const item of draft.lineItems) {
      if (!PlentyMockConnector.PRODUCTS.some((p) => p.id === item.productId)) {
        throw new NotFoundError(`Plenty-Variante '${item.productId}' nicht gefunden`);
      }
    }
  }

  async reserveStock(): Promise<ReservationResult> {
    throw new NotSupportedError("reserveStock", "Plentymarkets bietet keine eigenständige Bestandsreservierungs-API");
  }

  // ─── CRM ────────────────────────────────────────────────────────────────────

  async createFollowUpTask(): Promise<FollowUpTask> {
    throw new NotSupportedError("createFollowUpTask", "Plentymarkets-REST-API kennt keine generischen Aufgaben-Objekte");
  }

  async createAppointment(): Promise<Appointment> {
    throw new NotSupportedError("createAppointment", "Plentymarkets-REST-API kennt keine Termin-Objekte");
  }

  async createNote(): Promise<Note> {
    throw new NotSupportedError("createNote", "Plentymarkets-REST-API kennt keine generischen Notiz-Objekte");
  }
}
