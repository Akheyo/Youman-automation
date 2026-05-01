import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type {
  SearchRequest, SearchResult, Customer, Product,
  PriceInfo, StockInfo, QuoteDraft, FollowUpTask, Appointment, Note, Address,
} from "@youman/shared";
import type { IErpConnector, ConnectorHealthResult, QuoteResult, OrderResult, ReservationResult } from "./IErpConnector";
import { TokenManager, type AutoRefreshAuth } from "../auth/TokenManager";

export type AuthConfig =
  | { type: "none" }
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }
  | { type: "apikey"; apiKeyHeader?: string; apiKeyValue: string }
  | AutoRefreshAuth;

export interface RestGenericConfig {
  baseUrl: string;
  /**
   * Authentication. Static modes (basic/bearer/apikey) attach a fixed value
   * per request. Dynamic modes (oauth2_*, login) are managed by TokenManager
   * with caching + auto-refresh on 401.
   */
  auth?: AuthConfig;
  searchParam?: string;
  endpoints?: {
    customers?: string;
    products?: string;
    quotes?: string;
    tasks?: string;
    appointments?: string;
    notes?: string;
  };
}

/**
 * Build a diagnostic error message for connection-test failures. Includes the
 * resolved URL, HTTP status if any, and a hint when the failure mode points at
 * a wrong hostname (DNS / TLS-handshake errors).
 */
function formatHealthError(err: unknown, baseUrl: string): string {
  const e = err as {
    message?: string;
    code?: string;
    response?: { status?: number; statusText?: string; data?: unknown };
    config?: { url?: string; baseURL?: string; method?: string };
  };
  const method = e?.config?.method?.toUpperCase() ?? "GET";
  const path = e?.config?.url ?? "";
  const url = path.startsWith("http") ? path : `${e?.config?.baseURL ?? baseUrl}${path}`;

  if (e?.response?.status) {
    const status = e.response.status;
    const body = typeof e.response.data === "string"
      ? e.response.data.slice(0, 200)
      : JSON.stringify(e.response.data ?? {}).slice(0, 200);
    return `HTTP ${status} ${e.response.statusText ?? ""} bei ${method} ${url}${body ? ` — ${body}` : ""}`;
  }

  const code = e?.code ?? "";
  const hint =
    code === "ENOTFOUND" || code === "EAI_AGAIN"
      ? " — Hostname existiert nicht. Bitte prüfe die Basis-URL."
      : code === "ECONNREFUSED"
        ? " — Server lehnt Verbindung ab. Falscher Port oder Service offline."
        : code === "ETIMEDOUT" || code === "ECONNABORTED"
          ? " — Verbindungs-Timeout. Firewall oder erreichbarer Host?"
          : /TLS|certificate|socket disconnect/i.test(e?.message ?? "")
            ? " — TLS-Handshake fehlgeschlagen. Host serviert evtl. kein HTTPS unter dieser Domain, oder Firewall blockt."
            : "";

  return `${e?.message ?? "Unbekannter Fehler"} (${method} ${url})${hint}`;
}

// Normalize any common REST response shape to an array.
function toArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["items", "data", "results", "records", "value", "content"]) {
      if (Array.isArray(d[key])) return d[key] as Record<string, unknown>[];
    }
  }
  return [];
}

// Pick the first defined value for a set of candidate field names.
function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function str(v: unknown, fallback = ""): string {
  return v !== undefined && v !== null ? String(v) : fallback;
}

function isAutoRefreshAuth(auth: AuthConfig | undefined): auth is AutoRefreshAuth {
  return (
    auth?.type === "oauth2_client_credentials" ||
    auth?.type === "oauth2_refresh" ||
    auth?.type === "login"
  );
}

export class RestGenericConnector implements IErpConnector {
  readonly connectorType = "REST_GENERIC";
  readonly tenantId: string;

  private readonly http: AxiosInstance;
  private readonly cfg: RestGenericConfig;
  private readonly ep: Required<NonNullable<RestGenericConfig["endpoints"]>>;
  private readonly searchParam: string;
  private readonly tokenManager: TokenManager | null;

  constructor(tenantId: string, config: RestGenericConfig) {
    this.tenantId = tenantId;
    // Defensive: strip trailing slash and a trailing "/rest" segment so users
    // who paste "https://shop.example.com/rest/" don't end up with /rest/rest/.
    const cleanedBase = config.baseUrl
      .replace(/\/+$/, "")
      .replace(/\/rest$/i, "");
    this.cfg = { ...config, baseUrl: cleanedBase };
    this.searchParam = config.searchParam ?? "q";

    this.ep = {
      customers:    config.endpoints?.customers    ?? "/customers",
      products:     config.endpoints?.products     ?? "/products",
      quotes:       config.endpoints?.quotes       ?? "/quotes",
      tasks:        config.endpoints?.tasks        ?? "/tasks",
      appointments: config.endpoints?.appointments ?? "/appointments",
      notes:        config.endpoints?.notes        ?? "/notes",
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const auth = config.auth;
    // Static auth — fixed value per request, no token management needed.
    if (auth?.type === "bearer" && auth.token) {
      headers["Authorization"] = `Bearer ${auth.token}`;
    } else if (auth?.type === "apikey" && auth.apiKeyValue) {
      headers[auth.apiKeyHeader ?? "X-API-Key"] = auth.apiKeyValue;
    }

    this.http = axios.create({
      baseURL: cleanedBase,
      timeout: 30_000,
      headers,
      ...(auth?.type === "basic"
        ? { auth: { username: auth.username, password: auth.password ?? "" } }
        : {}),
    });

    // Dynamic auth — TokenManager handles acquisition + auto-refresh on 401.
    this.tokenManager = isAutoRefreshAuth(auth)
      ? new TokenManager(auth, cleanedBase)
      : null;

    if (this.tokenManager) {
      this.installAuthInterceptors(this.tokenManager);
    }
  }

  /** Attach a Bearer token before each request, refresh + retry once on 401. */
  private installAuthInterceptors(tm: TokenManager): void {
    this.http.interceptors.request.use(async (req: InternalAxiosRequestConfig) => {
      const token = await tm.getAccessToken();
      req.headers = req.headers ?? {};
      (req.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
      return req;
    });

    this.http.interceptors.response.use(
      (res) => res,
      async (err) => {
        const original = err?.config as InternalAxiosRequestConfig & { _retried?: boolean };
        if (err?.response?.status === 401 && original && !original._retried) {
          original._retried = true;
          try {
            const fresh = await tm.forceRefresh();
            original.headers = original.headers ?? {};
            (original.headers as Record<string, string>)["Authorization"] = `Bearer ${fresh}`;
            return this.http(original);
          } catch {
            // fall through to original error
          }
        }
        throw err;
      },
    );
  }

  async healthCheck(): Promise<ConnectorHealthResult> {
    const start = Date.now();
    try {
      // For dynamic auth (login/oauth), test the auth endpoint first — this
      // gives a clear "auth failed" vs "host unreachable" signal before we
      // attempt a data query that might fail for unrelated reasons.
      if (this.tokenManager) {
        await this.tokenManager.forceRefresh();
      }
      await this.http.get(this.ep.customers, { params: { [this.searchParam]: "test", limit: 1 } });
      return { healthy: true, latencyMs: Date.now() - start, message: "REST API erreichbar" };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: formatHealthError(err, this.cfg.baseUrl),
      };
    }
  }

  // ── Customers ────────────────────────────────────────────────────────────────

  async searchCustomers(req: SearchRequest): Promise<SearchResult<Customer>> {
    const start = Date.now();
    const res = await this.http.get(this.ep.customers, {
      params: { [this.searchParam]: req.query, limit: req.pageSize ?? 20, offset: ((req.page ?? 1) - 1) * (req.pageSize ?? 20) },
    });
    const items = toArray(res.data).map((r) => this.mapCustomer(r));
    return { items, total: items.length, page: req.page ?? 1, pageSize: req.pageSize ?? 20, hasMore: false, searchDurationMs: Date.now() - start };
  }

  async getCustomer(id: string): Promise<Customer> {
    const res = await this.http.get(`${this.ep.customers}/${id}`);
    const raw = Array.isArray(res.data) ? res.data[0] : (res.data as Record<string, unknown>);
    return this.mapCustomer(raw ?? {});
  }

  async createCustomer(data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Customer> {
    const addr = data.addresses?.[0];
    const res = await this.http.post(this.ep.customers, {
      name: data.name, name2: data.name2, email: data.email,
      phone: data.phone, mobile: data.mobile, currency: data.currency,
      taxNumber: data.taxNumber, vatId: data.vatId,
      ...(addr ? { street: `${addr.street} ${addr.streetNumber ?? ""}`.trim(), zip: addr.zip, city: addr.city, country: addr.countryCode } : {}),
    });
    const raw = (res.data as Record<string, unknown>);
    return this.mapCustomer(raw);
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const res = await this.http.patch(`${this.ep.customers}/${id}`, data);
    return this.mapCustomer(res.data as Record<string, unknown>);
  }

  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    try {
      const res = await this.http.get(`${this.ep.customers}/${customerId}/addresses`);
      return toArray(res.data).map((r) => this.mapAddress(r));
    } catch {
      return [];
    }
  }

  async createCustomerAddress(customerId: string, address: Omit<Address, "id">): Promise<Address> {
    const res = await this.http.post(`${this.ep.customers}/${customerId}/addresses`, address);
    return this.mapAddress(res.data as Record<string, unknown>);
  }

  private mapCustomer(r: Record<string, unknown>): Customer {
    return {
      id:             str(pick(r, "id", "customerId", "customer_id", "Kunnr")),
      externalId:     str(pick(r, "externalId", "external_id", "number", "customerNumber")),
      tenantId:       this.tenantId,
      customerNumber: str(pick(r, "customerNumber", "customer_number", "number", "Kunnr", "id")),
      name:           str(pick(r, "name", "Name", "fullName", "company", "Name1", "businessPartnerName")),
      name2:          str(pick(r, "name2", "Name2")) || undefined,
      email:          str(pick(r, "email", "Email", "emailAddress")) || undefined,
      phone:          str(pick(r, "phone", "Phone", "telephone", "Telf1")) || undefined,
      mobile:         str(pick(r, "mobile", "Mobile", "mobilePhone")) || undefined,
      currency:       str(pick(r, "currency", "Currency", "Waers"), "EUR"),
      isActive:       pick(r, "isActive", "active", "enabled") !== false,
      source:         "REST_GENERIC",
      addresses:      Array.isArray(r["addresses"]) ? (r["addresses"] as Record<string, unknown>[]).map((a) => this.mapAddress(a)) : [],
      createdAt:      str(pick(r, "createdAt", "created_at"), new Date().toISOString()),
      updatedAt:      str(pick(r, "updatedAt", "updated_at"), new Date().toISOString()),
    };
  }

  private mapAddress(r: Record<string, unknown>): Address {
    return {
      id:           str(pick(r, "id", "addressId", "address_id")),
      type:         (pick(r, "type", "addressType") as "billing" | "shipping") ?? "billing",
      street:       str(pick(r, "street", "Street", "streetName", "address")),
      streetNumber: str(pick(r, "streetNumber", "houseNumber", "street_number")) || undefined,
      zip:          str(pick(r, "zip", "postalCode", "postal_code", "PostlCod1")),
      city:         str(pick(r, "city", "City", "cityName")),
      countryCode:  str(pick(r, "countryCode", "country", "Country"), "DE"),
      isDefault:    pick(r, "isDefault", "default", "isDefaultAddress") === true,
    };
  }

  // ── Products ─────────────────────────────────────────────────────────────────

  async searchProducts(req: SearchRequest): Promise<SearchResult<Product>> {
    const start = Date.now();
    const res = await this.http.get(this.ep.products, {
      params: { [this.searchParam]: req.query, limit: req.pageSize ?? 20 },
    });
    const items = toArray(res.data).map((r) => this.mapProduct(r));
    return { items, total: items.length, page: req.page ?? 1, pageSize: req.pageSize ?? 20, hasMore: false, searchDurationMs: Date.now() - start };
  }

  async getProduct(id: string): Promise<Product> {
    const res = await this.http.get(`${this.ep.products}/${id}`);
    return this.mapProduct(res.data as Record<string, unknown>);
  }

  async createProduct(data: Omit<Product, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Product> {
    const res = await this.http.post(this.ep.products, {
      articleNumber: data.articleNumber, ean: data.ean,
      designation: data.designation, description: data.description,
      manufacturer: data.manufacturer, unit: data.unit,
      basePrice: data.basePrice, currency: data.currency, taxClass: data.taxClass,
    });
    return this.mapProduct(res.data as Record<string, unknown>);
  }

  async getProductStock(productId: string, _warehouseId?: string): Promise<StockInfo[]> {
    try {
      const res = await this.http.get(`${this.ep.products}/${productId}/stock`);
      const raw = toArray(res.data);
      if (raw.length > 0) {
        return raw.map((r) => ({
          productId,
          warehouseId: str(pick(r, "warehouseId", "warehouse")),
          warehouseName: str(pick(r, "warehouseName", "name")),
          available: Number(pick(r, "available", "quantity", "stock") ?? 0),
          reserved: Number(pick(r, "reserved") ?? 0),
          onOrder: Number(pick(r, "onOrder", "ordered") ?? 0),
          total: Number(pick(r, "total") ?? 0),
          unit: str(pick(r, "unit"), "ST"),
          updatedAt: new Date().toISOString(),
        }));
      }
    } catch { /* API may not support stock queries */ }
    return [];
  }

  async getProductPrice(productId: string, _customerId?: string, quantity = 1): Promise<PriceInfo> {
    try {
      const res = await this.http.get(`${this.ep.products}/${productId}/price`, { params: { quantity } });
      const r = res.data as Record<string, unknown>;
      return {
        productId,
        quantity,
        netPrice: Number(pick(r, "netPrice", "price", "net", "basePrice") ?? 0),
        grossPrice: Number(pick(r, "grossPrice", "gross") ?? 0),
        currency: str(pick(r, "currency"), "EUR"),
      };
    } catch {
      const prod = await this.getProduct(productId).catch(() => null);
      const net = (prod?.basePrice ?? 0) * quantity;
      return { productId, quantity, netPrice: net, grossPrice: net * 1.19, currency: prod?.currency ?? "EUR" };
    }
  }

  private mapProduct(r: Record<string, unknown>): Product {
    return {
      id:                      str(pick(r, "id", "productId", "articleNumber", "Matnr")),
      externalId:              str(pick(r, "externalId", "external_id", "Matnr")),
      tenantId:                this.tenantId,
      articleNumber:           str(pick(r, "articleNumber", "article_number", "sku", "number", "Matnr")),
      ean:                     str(pick(r, "ean", "Ean11", "barcode")) || undefined,
      designation:             str(pick(r, "designation", "name", "title", "description", "Maktx")),
      description:             str(pick(r, "description", "longDescription")) || undefined,
      manufacturer:            str(pick(r, "manufacturer", "brand", "Mfrnr")) || undefined,
      manufacturerArticleNumber: str(pick(r, "manufacturerArticleNumber", "mfrPartNumber", "Mfrpn")) || undefined,
      unit:                    str(pick(r, "unit", "unitOfMeasure", "Meins"), "ST"),
      basePrice:               Number(pick(r, "basePrice", "price", "Stprs") ?? 0),
      currency:                str(pick(r, "currency", "Waers"), "EUR"),
      taxClass:                str(pick(r, "taxClass", "taxRate", "Mwskz"), "STANDARD"),
      isActive:                pick(r, "isActive", "active", "enabled") !== false,
      source:                  "REST_GENERIC",
      createdAt:               str(pick(r, "createdAt", "created_at"), new Date().toISOString()),
      updatedAt:               str(pick(r, "updatedAt", "updated_at"), new Date().toISOString()),
    };
  }

  // ── Quotes / Orders ───────────────────────────────────────────────────────────

  async createQuote(draft: QuoteDraft): Promise<QuoteResult> {
    const res = await this.http.post(this.ep.quotes, {
      customerId: draft.customerId, customerNumber: draft.customerNumber,
      currency: draft.currency, validUntil: draft.validUntil, notes: draft.notes,
      lineItems: draft.lineItems.map((item) => ({
        articleNumber: item.articleNumber, designation: item.designation,
        quantity: item.quantity, unit: item.unit,
        pricePerUnit: item.pricePerUnit, discount: item.discount,
      })),
    });
    const d = res.data as Record<string, unknown>;
    const nr = str(pick(d, "quoteNumber", "number", "id", "quoteId"));
    return {
      erpQuoteId:     str(pick(d, "id", "quoteId", "erpQuoteId"), nr),
      erpQuoteNumber: str(pick(d, "quoteNumber", "number", "erpQuoteNumber"), nr),
      pdfUrl:         str(pick(d, "pdfUrl", "pdf", "document")) || undefined,
      status:         "created",
      createdAt:      new Date().toISOString(),
    };
  }

  async createSalesOrder(draft: QuoteDraft): Promise<OrderResult> {
    const endpoint = this.cfg.endpoints?.quotes ? this.cfg.endpoints.quotes.replace("quotes", "orders") : "/orders";
    const res = await this.http.post(endpoint, { customerId: draft.customerId, lineItems: draft.lineItems });
    const d = res.data as Record<string, unknown>;
    const nr = str(pick(d, "orderNumber", "number", "id"));
    return { erpOrderId: str(pick(d, "id"), nr), erpOrderNumber: nr, status: "created", createdAt: new Date().toISOString() };
  }

  async reserveStock(_productId: string, quantity: number, warehouseId?: string): Promise<ReservationResult> {
    return {
      reservationId: crypto.randomUUID(),
      productId: _productId, quantity,
      warehouseId: warehouseId ?? "DEFAULT",
      status: "confirmed", confirmedQuantity: quantity,
    };
  }

  // ── CRM ───────────────────────────────────────────────────────────────────────

  async createFollowUpTask(task: Omit<FollowUpTask, "id" | "createdAt" | "updatedAt">): Promise<FollowUpTask> {
    const res = await this.http.post(this.ep.tasks, {
      title: task.title, description: task.description,
      dueDate: task.dueDate, priority: task.priority,
      customerId: task.relatedCustomerId, quoteId: task.relatedQuoteId,
    });
    const d = res.data as Record<string, unknown>;
    return {
      ...task,
      id: str(pick(d, "id", "taskId")),
      erpTaskId: str(pick(d, "id", "externalId")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createAppointment(appt: Omit<Appointment, "id" | "createdAt" | "updatedAt">): Promise<Appointment> {
    const res = await this.http.post(this.ep.appointments, {
      title: appt.title, description: appt.description,
      startAt: appt.startAt, endAt: appt.endAt,
      location: appt.location, customerId: appt.customerId,
    });
    const d = res.data as Record<string, unknown>;
    return {
      ...appt,
      id: str(pick(d, "id", "appointmentId")),
      erpAppointmentId: str(pick(d, "id", "externalId")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createNote(note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> {
    const res = await this.http.post(this.ep.notes, {
      content: note.content, customerId: note.customerId, tags: note.tags,
    });
    const d = res.data as Record<string, unknown>;
    return {
      ...note,
      id: str(pick(d, "id", "noteId")),
      erpNoteId: str(pick(d, "id", "externalId")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
