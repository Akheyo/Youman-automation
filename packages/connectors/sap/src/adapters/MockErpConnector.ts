import type { SearchRequest, SearchResult, Customer, Product, PriceInfo, StockInfo, QuoteDraft, FollowUpTask, Appointment, Note, Address } from "@youman/shared";
import type { IErpConnector, ConnectorHealthResult, QuoteResult, OrderResult, ReservationResult } from "./IErpConnector";

/**
 * Mock connector for development, testing and demo tenants.
 * Returns realistic sample data without requiring a live SAP system.
 */
export class MockErpConnector implements IErpConnector {
  readonly connectorType = "MOCK";
  readonly tenantId: string;

  private static readonly CUSTOMERS: Customer[] = [
    {
      id: "cust-001", externalId: "10001", tenantId: "", customerNumber: "10001",
      name: "Mustermann GmbH", email: "info@mustermann.de", phone: "+49 89 123456",
      currency: "EUR", isActive: true, source: "MOCK",
      addresses: [{
        id: "addr-001", type: "billing", street: "Musterstraße", streetNumber: "12",
        zip: "80331", city: "München", countryCode: "DE", isDefault: true
      }],
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z"
    },
    {
      id: "cust-002", externalId: "10002", tenantId: "", customerNumber: "10002",
      name: "Schmidt & Partner KG", email: "kontakt@schmidt-partner.de", phone: "+49 40 987654",
      currency: "EUR", isActive: true, source: "MOCK",
      addresses: [{
        id: "addr-002", type: "billing", street: "Hamburger Allee", streetNumber: "7",
        zip: "20095", city: "Hamburg", countryCode: "DE", isDefault: true
      }],
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z"
    },
    {
      id: "cust-003", externalId: "10003", tenantId: "", customerNumber: "10003",
      name: "Technik AG Berlin", email: "einkauf@technik-ag.de", phone: "+49 30 555888",
      currency: "EUR", isActive: true, source: "MOCK",
      addresses: [{
        id: "addr-003", type: "billing", street: "Berliner Str.", streetNumber: "100",
        zip: "10115", city: "Berlin", countryCode: "DE", isDefault: true
      }],
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z"
    },
  ];

  private static readonly PRODUCTS: Product[] = [
    {
      id: "prod-001", externalId: "MAT-001", tenantId: "", articleNumber: "MAT-001",
      ean: "4012345678901", designation: "Schraube M8x20 DIN 933", manufacturer: "Würth",
      manufacturerArticleNumber: "WU-M8-20", unit: "ST", basePrice: 0.45, currency: "EUR",
      taxClass: "STANDARD", isActive: true, source: "MOCK",
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z"
    },
    {
      id: "prod-002", externalId: "MAT-002", tenantId: "", articleNumber: "MAT-002",
      ean: "4012345678902", designation: "Hydraulikschlauch DN10 1m", manufacturer: "Parker",
      unit: "M", basePrice: 12.50, currency: "EUR", taxClass: "STANDARD", isActive: true, source: "MOCK",
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z"
    },
    {
      id: "prod-003", externalId: "MAT-003", tenantId: "", articleNumber: "MAT-003",
      ean: "4012345678903", designation: "Antriebsmotor 3kW 4-polig", manufacturer: "Siemens",
      unit: "ST", basePrice: 389.00, currency: "EUR", taxClass: "STANDARD", isActive: true, source: "MOCK",
      createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z"
    },
  ];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private delay(ms = 200): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async healthCheck(): Promise<ConnectorHealthResult> {
    await this.delay(50);
    return { healthy: true, latencyMs: 50, message: "Mock connector – always healthy" };
  }

  async searchCustomers(req: SearchRequest): Promise<SearchResult<Customer>> {
    await this.delay(200);
    const q = req.query.toLowerCase();
    const items = MockErpConnector.CUSTOMERS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.customerNumber.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    ).map((c) => ({ ...c, tenantId: this.tenantId }));

    return { items, total: items.length, page: 1, pageSize: 20, hasMore: false, searchDurationMs: 200 };
  }

  async getCustomer(id: string): Promise<Customer> {
    await this.delay(100);
    const c = MockErpConnector.CUSTOMERS.find((c) => c.id === id);
    if (!c) throw new Error(`Customer '${id}' not found`);
    return { ...c, tenantId: this.tenantId };
  }

  async createCustomer(data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Customer> {
    await this.delay(400);
    const nr = String(10000 + MockErpConnector.CUSTOMERS.length + 1);
    return {
      ...data,
      id: `cust-${crypto.randomUUID().slice(0, 8)}`,
      externalId: nr,
      customerNumber: nr,
      tenantId: this.tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    await this.delay(300);
    const c = await this.getCustomer(id);
    return { ...c, ...data, updatedAt: new Date().toISOString() };
  }

  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    await this.delay(150);
    const c = await this.getCustomer(customerId);
    return c.addresses;
  }

  async createCustomerAddress(customerId: string, address: Omit<Address, "id">): Promise<Address> {
    await this.delay(300);
    return { ...address, id: `addr-${crypto.randomUUID().slice(0, 8)}` };
  }

  async searchProducts(req: SearchRequest): Promise<SearchResult<Product>> {
    await this.delay(200);
    const q = req.query.toLowerCase();
    const items = MockErpConnector.PRODUCTS.filter(
      (p) =>
        p.designation.toLowerCase().includes(q) ||
        p.articleNumber.toLowerCase().includes(q) ||
        p.ean?.includes(q) ||
        p.manufacturer?.toLowerCase().includes(q)
    ).map((p) => ({ ...p, tenantId: this.tenantId }));

    return { items, total: items.length, page: 1, pageSize: 20, hasMore: false, searchDurationMs: 200 };
  }

  async getProduct(id: string): Promise<Product> {
    await this.delay(100);
    const p = MockErpConnector.PRODUCTS.find((p) => p.id === id);
    if (!p) throw new Error(`Product '${id}' not found`);
    return { ...p, tenantId: this.tenantId };
  }

  async createProduct(data: Omit<Product, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Product> {
    await this.delay(400);
    const nr = `MAT-${String(MockErpConnector.PRODUCTS.length + 100).padStart(3, "0")}`;
    return {
      ...data,
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      externalId: nr,
      articleNumber: nr,
      tenantId: this.tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getProductStock(_productId: string, warehouseId?: string): Promise<StockInfo[]> {
    await this.delay(150);
    return [{
      productId: _productId,
      warehouseId: warehouseId ?? "0001",
      warehouseName: "Hauptlager",
      available: Math.floor(Math.random() * 500),
      reserved: Math.floor(Math.random() * 20),
      onOrder: 0,
      total: 600,
      unit: "ST",
      updatedAt: new Date().toISOString(),
    }];
  }

  async getProductPrice(productId: string, _customerId?: string, quantity = 1): Promise<PriceInfo> {
    await this.delay(100);
    const p = MockErpConnector.PRODUCTS.find((p) => p.id === productId);
    const net = (p?.basePrice ?? 10) * (quantity >= 100 ? 0.85 : quantity >= 10 ? 0.92 : 1);
    return {
      productId,
      quantity,
      netPrice: net,
      grossPrice: net * 1.19,
      currency: "EUR",
    };
  }

  async createQuote(draft: QuoteDraft): Promise<QuoteResult> {
    await this.delay(600);
    const nr = `ANG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    return {
      erpQuoteId: nr,
      erpQuoteNumber: nr,
      pdfUrl: `https://erp.example.com/quotes/${nr}.pdf`,
      status: "created",
      createdAt: new Date().toISOString(),
    };
  }

  async createSalesOrder(draft: QuoteDraft): Promise<OrderResult> {
    await this.delay(600);
    const nr = `AUF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    return { erpOrderId: nr, erpOrderNumber: nr, status: "created", createdAt: new Date().toISOString() };
  }

  async reserveStock(productId: string, quantity: number, warehouseId?: string): Promise<ReservationResult> {
    await this.delay(300);
    return {
      reservationId: `RES-${crypto.randomUUID().slice(0, 8)}`,
      productId,
      quantity,
      warehouseId: warehouseId ?? "0001",
      status: "confirmed",
      confirmedQuantity: quantity,
    };
  }

  async createFollowUpTask(task: Omit<FollowUpTask, "id" | "createdAt" | "updatedAt">): Promise<FollowUpTask> {
    await this.delay(300);
    return {
      ...task,
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      erpTaskId: `ACT-${Math.floor(Math.random() * 99999)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createAppointment(appt: Omit<Appointment, "id" | "createdAt" | "updatedAt">): Promise<Appointment> {
    await this.delay(300);
    return {
      ...appt,
      id: `appt-${crypto.randomUUID().slice(0, 8)}`,
      erpAppointmentId: `APP-${Math.floor(Math.random() * 99999)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createNote(note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> {
    await this.delay(200);
    return {
      ...note,
      id: `note-${crypto.randomUUID().slice(0, 8)}`,
      erpNoteId: `NOTE-${Math.floor(Math.random() * 99999)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
