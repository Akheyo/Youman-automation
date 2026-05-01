import type {
  SearchRequest, SearchResult, Customer, Product, PriceInfo, StockInfo,
  QuoteDraft, FollowUpTask, Appointment, Note, Address,
} from "@youman/shared";
import type {
  IErpConnector, ConnectorHealthResult, QuoteResult, OrderResult, ReservationResult,
} from "./IErpConnector";

/**
 * Mock connector — for development, demos and tenants without a real ERP.
 *
 * Maintains a per-tenant in-memory store so that anything created via the
 * connector (customers, products, quotes, etc.) is afterwards findable via
 * the search/get endpoints. State lives for the lifetime of the backend
 * process; restart wipes it. Suitable for sales demos and CI tests; not
 * for production data.
 */
export class MockErpConnector implements IErpConnector {
  readonly connectorType = "MOCK";
  readonly tenantId: string;

  // Shared across instances per tenant — the connectors service caches one
  // instance per tenant anyway, but using a static map makes the pattern
  // explicit and survives if the cache is rebuilt.
  private static readonly stores = new Map<string, TenantStore>();

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    if (!MockErpConnector.stores.has(tenantId)) {
      MockErpConnector.stores.set(tenantId, createSeededStore(tenantId));
    }
  }

  private get store(): TenantStore {
    return MockErpConnector.stores.get(this.tenantId)!;
  }

  private delay(ms = 200): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async healthCheck(): Promise<ConnectorHealthResult> {
    await this.delay(20);
    return {
      healthy: true,
      latencyMs: 20,
      message: "Mock connector — always healthy",
      details: {
        customers: this.store.customers.size,
        products: this.store.products.size,
        quotes: this.store.quotes.size,
      },
    };
  }

  // ── Customers ─────────────────────────────────────────────────────────────

  async searchCustomers(req: SearchRequest): Promise<SearchResult<Customer>> {
    await this.delay(120);
    const q = (req.query ?? "").toLowerCase().trim();
    const all = [...this.store.customers.values()];
    const matched = q
      ? all.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.customerNumber.includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q),
        )
      : all;
    const pageSize = req.pageSize ?? 20;
    const items = matched.slice(0, pageSize);
    return {
      items,
      total: matched.length,
      page: 1,
      pageSize,
      hasMore: matched.length > pageSize,
      searchDurationMs: 120,
    };
  }

  async getCustomer(id: string): Promise<Customer> {
    await this.delay(40);
    const c = this.store.customers.get(id);
    if (!c) throw new Error(`Customer '${id}' not found`);
    return c;
  }

  async createCustomer(
    data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">,
  ): Promise<Customer> {
    await this.delay(300);
    const number = String(this.store.customerCounter++);
    const customer: Customer = {
      ...data,
      id: `cust-${number}`,
      externalId: number,
      customerNumber: data.customerNumber || number,
      tenantId: this.tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.customers.set(customer.id, customer);
    return customer;
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    await this.delay(200);
    const existing = await this.getCustomer(id);
    const updated: Customer = { ...existing, ...data, id, tenantId: this.tenantId, updatedAt: new Date().toISOString() };
    this.store.customers.set(id, updated);
    return updated;
  }

  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    await this.delay(80);
    const c = await this.getCustomer(customerId);
    return c.addresses;
  }

  async createCustomerAddress(customerId: string, address: Omit<Address, "id">): Promise<Address> {
    await this.delay(200);
    const customer = await this.getCustomer(customerId);
    const newAddress: Address = { ...address, id: `addr-${randomId()}` };
    const addresses = [...customer.addresses];
    if (newAddress.isDefault) {
      // Demote the previously-default address of the same type
      for (const a of addresses) {
        if (a.type === newAddress.type) a.isDefault = false;
      }
    }
    addresses.push(newAddress);
    this.store.customers.set(customerId, { ...customer, addresses, updatedAt: new Date().toISOString() });
    return newAddress;
  }

  // ── Products ──────────────────────────────────────────────────────────────

  async searchProducts(req: SearchRequest): Promise<SearchResult<Product>> {
    await this.delay(120);
    const q = (req.query ?? "").toLowerCase().trim();
    const all = [...this.store.products.values()];
    const matched = q
      ? all.filter(
          (p) =>
            p.designation.toLowerCase().includes(q) ||
            p.articleNumber.toLowerCase().includes(q) ||
            p.ean?.includes(q) ||
            p.manufacturer?.toLowerCase().includes(q),
        )
      : all;
    const pageSize = req.pageSize ?? 20;
    const items = matched.slice(0, pageSize);
    return {
      items,
      total: matched.length,
      page: 1,
      pageSize,
      hasMore: matched.length > pageSize,
      searchDurationMs: 120,
    };
  }

  async getProduct(id: string): Promise<Product> {
    await this.delay(40);
    const p = this.store.products.get(id);
    if (!p) throw new Error(`Product '${id}' not found`);
    return p;
  }

  async createProduct(
    data: Omit<Product, "id" | "externalId" | "createdAt" | "updatedAt">,
  ): Promise<Product> {
    await this.delay(300);
    const number = `MAT-${String(this.store.productCounter++).padStart(4, "0")}`;
    const product: Product = {
      ...data,
      id: `prod-${number.toLowerCase()}`,
      externalId: number,
      articleNumber: data.articleNumber || number,
      tenantId: this.tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.products.set(product.id, product);
    return product;
  }

  async getProductStock(productId: string, warehouseId?: string): Promise<StockInfo[]> {
    await this.delay(80);
    // Deterministic per-product stock so that repeated calls show the same
    // numbers, not random noise that confuses the user.
    const base = hashCode(productId);
    const available = (base % 800) + 10;
    const reserved = (base % 30);
    return [
      {
        productId,
        warehouseId: warehouseId ?? "0001",
        warehouseName: warehouseId === "0002" ? "Außenlager Köln" : "Hauptlager",
        available,
        reserved,
        onOrder: 0,
        total: available + reserved,
        unit: "ST",
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  async getProductPrice(productId: string, _customerId?: string, quantity = 1): Promise<PriceInfo> {
    await this.delay(60);
    const p = this.store.products.get(productId);
    const base = p?.basePrice ?? 10;
    // Volume discount tiers: <10 = full price, 10-99 = 8%, 100+ = 15%
    const factor = quantity >= 100 ? 0.85 : quantity >= 10 ? 0.92 : 1;
    const net = round2(base * factor);
    return {
      productId,
      quantity,
      netPrice: net,
      grossPrice: round2(net * 1.19),
      currency: "EUR",
    };
  }

  // ── Quotes / Orders ───────────────────────────────────────────────────────

  async createQuote(draft: QuoteDraft): Promise<QuoteResult> {
    await this.delay(450);
    const year = new Date().getFullYear();
    const number = `ANG-${year}-${String(this.store.quoteCounter++).padStart(5, "0")}`;
    const result: QuoteResult = {
      erpQuoteId: number,
      erpQuoteNumber: number,
      pdfUrl: `https://mock.adept.local/quotes/${number}.pdf`,
      status: "created",
      createdAt: new Date().toISOString(),
    };
    this.store.quotes.set(number, { ...draft, ...result });
    return result;
  }

  async createSalesOrder(draft: QuoteDraft): Promise<OrderResult> {
    await this.delay(450);
    const year = new Date().getFullYear();
    const number = `AUF-${year}-${String(this.store.orderCounter++).padStart(5, "0")}`;
    const result: OrderResult = {
      erpOrderId: number,
      erpOrderNumber: number,
      status: "created",
      createdAt: new Date().toISOString(),
    };
    this.store.orders.set(number, { ...draft, ...result });
    return result;
  }

  async reserveStock(productId: string, quantity: number, warehouseId?: string): Promise<ReservationResult> {
    await this.delay(180);
    const stock = await this.getProductStock(productId, warehouseId);
    const available = stock[0]?.available ?? 0;
    const confirmedQuantity = Math.min(quantity, available);
    return {
      reservationId: `RES-${randomId()}`,
      productId,
      quantity,
      warehouseId: warehouseId ?? "0001",
      status: confirmedQuantity === quantity ? "confirmed" : confirmedQuantity > 0 ? "partial" : "failed",
      confirmedQuantity,
    };
  }

  // ── CRM ───────────────────────────────────────────────────────────────────

  async createFollowUpTask(task: Omit<FollowUpTask, "id" | "createdAt" | "updatedAt">): Promise<FollowUpTask> {
    await this.delay(180);
    const id = `task-${randomId()}`;
    const created: FollowUpTask = {
      ...task,
      id,
      erpTaskId: `ACT-${this.store.taskCounter++}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.tasks.set(id, created);
    return created;
  }

  async createAppointment(appt: Omit<Appointment, "id" | "createdAt" | "updatedAt">): Promise<Appointment> {
    await this.delay(180);
    const id = `appt-${randomId()}`;
    const created: Appointment = {
      ...appt,
      id,
      erpAppointmentId: `APP-${this.store.appointmentCounter++}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.appointments.set(id, created);
    return created;
  }

  async createNote(note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> {
    await this.delay(150);
    const id = `note-${randomId()}`;
    const created: Note = {
      ...note,
      id,
      erpNoteId: `NOTE-${this.store.noteCounter++}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.notes.set(id, created);
    return created;
  }
}

// ─── Internal types & helpers ──────────────────────────────────────────────

interface TenantStore {
  customers: Map<string, Customer>;
  products: Map<string, Product>;
  quotes: Map<string, unknown>;
  orders: Map<string, unknown>;
  tasks: Map<string, FollowUpTask>;
  appointments: Map<string, Appointment>;
  notes: Map<string, Note>;
  customerCounter: number;
  productCounter: number;
  quoteCounter: number;
  orderCounter: number;
  taskCounter: number;
  appointmentCounter: number;
  noteCounter: number;
}

function randomId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** djb2-ish hash so we get deterministic numbers from a string id. */
function hashCode(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function createSeededStore(tenantId: string): TenantStore {
  const customers = new Map<string, Customer>();
  const products = new Map<string, Product>();

  for (const c of seedCustomers(tenantId)) customers.set(c.id, c);
  for (const p of seedProducts(tenantId)) products.set(p.id, p);

  return {
    customers,
    products,
    quotes: new Map(),
    orders: new Map(),
    tasks: new Map(),
    appointments: new Map(),
    notes: new Map(),
    customerCounter: 10000 + customers.size + 1,
    productCounter: 100 + products.size + 1,
    quoteCounter: 1,
    orderCounter: 1,
    taskCounter: 1,
    appointmentCounter: 1,
    noteCounter: 1,
  };
}

function seedCustomers(tenantId: string): Customer[] {
  const now = "2024-01-01T00:00:00Z";
  const base = (
    customerNumber: string,
    name: string,
    email: string,
    phone: string,
    street: string,
    streetNumber: string,
    zip: string,
    city: string,
  ): Customer => ({
    id: `cust-${customerNumber}`,
    externalId: customerNumber,
    tenantId,
    customerNumber,
    name,
    email,
    phone,
    currency: "EUR",
    isActive: true,
    source: "MOCK",
    addresses: [
      {
        id: `addr-${customerNumber}`,
        type: "billing",
        street,
        streetNumber,
        zip,
        city,
        countryCode: "DE",
        isDefault: true,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  return [
    base("10001", "Mustermann GmbH",          "info@mustermann.de",       "+49 89 1234560",  "Musterstraße",      "12", "80331", "München"),
    base("10002", "Schmidt & Partner KG",     "kontakt@schmidt-partner.de","+49 40 9876540", "Hamburger Allee",   "7",  "20095", "Hamburg"),
    base("10003", "Technik AG Berlin",        "einkauf@technik-ag.de",    "+49 30 5558880",  "Berliner Str.",     "100","10115", "Berlin"),
    base("10004", "Bauer Industrieservice",   "service@bauer-ind.de",     "+49 711 4451220", "Stuttgarter Weg",   "45", "70173", "Stuttgart"),
    base("10005", "Nordwerk Maschinenbau",    "vertrieb@nordwerk.de",     "+49 421 3328910", "Hafenstraße",       "88", "28195", "Bremen"),
    base("10006", "Rheinland Logistik GmbH",  "info@rheinland-log.de",    "+49 221 7766550", "Kölner Ring",       "23", "50667", "Köln"),
    base("10007", "Alpenwerk eG",             "service@alpenwerk.de",     "+49 89 8870230",  "Gärtnerstraße",     "5",  "80939", "München"),
    base("10008", "Hansa Stahl GmbH",         "auftrag@hansa-stahl.de",   "+49 40 4458822",  "Reeperbahn",        "201","20359", "Hamburg"),
    base("10009", "Westfalen Bau & Co",       "kontakt@westfalen-bau.de", "+49 251 6671100", "Domplatz",          "9",  "48143", "Münster"),
    base("10010", "Sonnenberg Solar GmbH",    "info@sonnenberg-solar.de", "+49 761 5599012", "Schwarzwaldstr.",   "33", "79100", "Freiburg"),
    base("10011", "Fränkische Werkzeuge KG",  "vertrieb@fraenkische-wkz.de","+49 911 7782200","Nürnberger Tor",   "14", "90402", "Nürnberg"),
    base("10012", "Ostsee Yachtbau GmbH",     "info@ostsee-yacht.de",     "+49 431 9988770", "Hafenkante",        "1",  "24103", "Kiel"),
    base("10013", "Müller Elektrotechnik",    "kundenservice@muller-et.de","+49 351 4456680","Altmarkt",         "12", "01067", "Dresden"),
    base("10014", "Sauerland Holzwerk",       "info@sauerland-holz.de",   "+49 2941 776230", "Waldstraße",        "27", "59494", "Soest"),
    base("10015", "ProTec Engineering GmbH",  "office@protec-eng.de",     "+49 6221 884420", "Heidelberger Allee","56", "69115", "Heidelberg"),
  ];
}

function seedProducts(tenantId: string): Product[] {
  const now = "2024-01-01T00:00:00Z";
  const base = (
    n: string,
    designation: string,
    manufacturer: string,
    unit: string,
    basePrice: number,
    ean?: string,
  ): Product => ({
    id: `prod-mat-${n.toLowerCase()}`,
    externalId: `MAT-${n}`,
    tenantId,
    articleNumber: `MAT-${n}`,
    ean,
    designation,
    manufacturer,
    unit,
    basePrice,
    currency: "EUR",
    taxClass: "STANDARD",
    isActive: true,
    source: "MOCK",
    createdAt: now,
    updatedAt: now,
  });

  return [
    base("0001", "Schraube M8x20 DIN 933",          "Würth",     "ST", 0.45,  "4012345678901"),
    base("0002", "Hydraulikschlauch DN10 1m",        "Parker",    "M",  12.50, "4012345678902"),
    base("0003", "Antriebsmotor 3kW 4-polig",        "Siemens",   "ST", 389.00,"4012345678903"),
    base("0004", "Lager 6205-2RS",                   "SKF",       "ST", 8.90,  "4012345678904"),
    base("0005", "Kabel NYM-J 3x1,5 100m",           "Lapp",      "ROL",78.00, "4012345678905"),
    base("0006", "LED-Industrieleuchte 150W IP65",    "Trilux",    "ST", 245.00,"4012345678906"),
    base("0007", "Frequenzumrichter 5,5kW",          "Danfoss",   "ST", 720.00,"4012345678907"),
    base("0008", "Pneumatikzylinder DSBC-50-100",    "Festo",     "ST", 156.00,"4012345678908"),
    base("0009", "Edelstahlblech 1mm 1000x500mm",     "ThyssenKrupp","ST",62.00,"4012345678909"),
    base("0010", "Schweißdraht G3Si1 1,2mm 15kg",     "ESAB",      "ROL",58.00, "4012345678910"),
    base("0011", "Sicherung NH00 100A gG",            "Mersen",    "ST", 6.20,  "4012345678911"),
    base("0012", "Kugelhahn DN25 Edelstahl",          "GF",        "ST", 42.00, "4012345678912"),
    base("0013", "Ölfilter 0,3 mu industrial",        "Mann+Hummel","ST",29.50, "4012345678913"),
    base("0014", "Förderband PVC 800mm 10m",          "Habasit",   "M",  89.00, "4012345678914"),
    base("0015", "Steuerungs-SPS S7-1200 CPU 1214C",  "Siemens",   "ST", 980.00,"4012345678915"),
    base("0016", "Sensor induktiv M18",               "Pepperl+Fuchs","ST",54.00,"4012345678916"),
    base("0017", "Klemmleiste 4mm² 12-polig",         "Phoenix",   "ST", 11.40, "4012345678917"),
    base("0018", "Trennschleifscheibe 230mm",         "Bosch",     "ST", 3.20,  "4012345678918"),
    base("0019", "Sicherheitsschuh S3 Gr.43",         "uvex",      "PA", 89.00, "4012345678919"),
    base("0020", "Atemschutzmaske FFP3 ventilfrei",    "3M",        "ST", 4.90,  "4012345678920"),
  ];
}
