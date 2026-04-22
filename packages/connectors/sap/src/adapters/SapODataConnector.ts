import axios, { type AxiosInstance, type AxiosError } from "axios";
import type { SearchRequest, SearchResult, Customer, Product, PriceInfo, StockInfo, QuoteDraft, FollowUpTask, Appointment, Note, Address } from "@youman/shared";
import type { IErpConnector, ConnectorHealthResult, QuoteResult, OrderResult, ReservationResult } from "./IErpConnector";
import type { SapConfig } from "../types/SapConfig";

/**
 * SAP OData V2/V4 Connector
 * Implements the generic IErpConnector interface against SAP OData services.
 *
 * In a real setup, the entity set names and field mappings come from ConnectorConfig
 * stored per tenant, so different SAP systems can be mapped without code changes.
 */
export class SapODataConnector implements IErpConnector {
  readonly connectorType = "SAP_ODATA";
  readonly tenantId: string;

  private readonly http: AxiosInstance;
  private readonly config: SapConfig;
  private csrfToken: string | null = null;

  constructor(tenantId: string, config: SapConfig) {
    this.tenantId = tenantId;
    this.config = config;

    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 30_000,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "sap-client": config.client,
        "Accept-Language": config.language ?? "de",
      },
    });

    this.setupAuth();
    this.setupInterceptors();
  }

  private setupAuth(): void {
    if (this.config.auth.type === "basic") {
      this.http.defaults.auth = {
        username: this.config.auth.username!,
        password: this.config.auth.password!,
      };
    }
  }

  private setupInterceptors(): void {
    this.http.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        const sapError = this.parseSapError(err);
        throw sapError;
      }
    );
  }

  private parseSapError(err: AxiosError): Error {
    const data = err.response?.data as Record<string, unknown> | undefined;
    const sapMsg =
      (data?.error as Record<string, unknown> | undefined)?.message as
        | Record<string, unknown>
        | undefined;
    const message = sapMsg?.value ?? err.message ?? "SAP error";
    const code = (data?.error as Record<string, unknown> | undefined)?.code ?? "SAP_ERROR";
    const error = new Error(String(message));
    (error as Error & { code: unknown }).code = code;
    return error;
  }

  private async fetchCsrfToken(): Promise<string> {
    const res = await this.http.get("/", {
      headers: { "X-CSRF-Token": "Fetch" },
    });
    const token = res.headers["x-csrf-token"] as string | undefined;
    if (!token) throw new Error("Could not fetch CSRF token from SAP");
    this.csrfToken = token;
    return token;
  }

  private async getMutationHeaders(): Promise<Record<string, string>> {
    const token = this.csrfToken ?? (await this.fetchCsrfToken());
    return { "X-CSRF-Token": token };
  }

  async healthCheck(): Promise<ConnectorHealthResult> {
    const start = Date.now();
    try {
      await this.http.get("/");
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async searchCustomers(req: SearchRequest): Promise<SearchResult<Customer>> {
    const entitySet = this.config.entitySets?.customers ?? "BusinessPartnerSet";
    const filter = this.buildCustomerFilter(req.query);
    const top = req.pageSize ?? 20;
    const skip = ((req.page ?? 1) - 1) * top;

    const start = Date.now();
    const res = await this.http.get(`/${entitySet}`, {
      params: {
        $filter: filter,
        $top: top,
        $skip: skip,
        $format: "json",
        $inlinecount: "allpages",
      },
    });

    const raw = res.data?.d?.results ?? [];
    const total = Number(res.data?.d?.__count ?? raw.length);

    return {
      items: raw.map((r: Record<string, unknown>) => this.mapCustomer(r)),
      total,
      page: req.page ?? 1,
      pageSize: top,
      hasMore: skip + raw.length < total,
      searchDurationMs: Date.now() - start,
    };
  }

  private buildCustomerFilter(query: string): string {
    const q = query.replace(/'/g, "''");
    return [
      `substringof('${q}', Name1)`,
      `substringof('${q}', Kunnr)`,
      `substringof('${q}', Telf1)`,
      `substringof('${q}', Smtp)`,
    ].join(" or ");
  }

  private mapCustomer(raw: Record<string, unknown>): Customer {
    return {
      id: String(raw["Kunnr"] ?? raw["BusinessPartner"] ?? ""),
      externalId: String(raw["Kunnr"] ?? raw["BusinessPartner"] ?? ""),
      tenantId: this.tenantId,
      customerNumber: String(raw["Kunnr"] ?? raw["BusinessPartner"] ?? ""),
      name: String(raw["Name1"] ?? raw["BusinessPartnerName"] ?? ""),
      name2: raw["Name2"] ? String(raw["Name2"]) : undefined,
      email: raw["Smtp"] ? String(raw["Smtp"]) : undefined,
      phone: raw["Telf1"] ? String(raw["Telf1"]) : undefined,
      currency: String(raw["Waers"] ?? "EUR"),
      isActive: raw["Loevm"] !== "X",
      source: "SAP_ODATA",
      addresses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getCustomer(id: string): Promise<Customer> {
    const entitySet = this.config.entitySets?.customers ?? "BusinessPartnerSet";
    const res = await this.http.get(`/${entitySet}('${id}')`, {
      params: { $format: "json", $expand: "to_BusinessPartnerAddress" },
    });
    return this.mapCustomer(res.data?.d ?? {});
  }

  async createCustomer(
    data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">
  ): Promise<Customer> {
    const entitySet = this.config.entitySets?.customers ?? "BusinessPartnerSet";
    const headers = await this.getMutationHeaders();
    const payload = this.buildCustomerPayload(data);

    const res = await this.http.post(`/${entitySet}`, payload, { headers });
    return this.mapCustomer(res.data?.d ?? {});
  }

  private buildCustomerPayload(data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">): Record<string, unknown> {
    const addr = data.addresses[0];
    return {
      Name1: data.name,
      Name2: data.name2 ?? "",
      Smtp: data.email ?? "",
      Telf1: data.phone ?? "",
      Waers: data.currency ?? "EUR",
      ...(addr
        ? {
            Street: addr.street,
            HouseNum1: addr.streetNumber ?? "",
            PostlCod1: addr.zip,
            City1: addr.city,
            Country: addr.countryCode,
          }
        : {}),
    };
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const entitySet = this.config.entitySets?.customers ?? "BusinessPartnerSet";
    const headers = await this.getMutationHeaders();
    await this.http.patch(`/${entitySet}('${id}')`, data, { headers });
    return this.getCustomer(id);
  }

  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    const res = await this.http.get(
      `/BusinessPartnerSet('${customerId}')/to_BusinessPartnerAddress`,
      { params: { $format: "json" } }
    );
    const raw: Record<string, unknown>[] = res.data?.d?.results ?? [];
    return raw.map((r) => this.mapAddress(r));
  }

  async createCustomerAddress(customerId: string, address: Omit<Address, "id">): Promise<Address> {
    const headers = await this.getMutationHeaders();
    const res = await this.http.post(
      `/BusinessPartnerSet('${customerId}')/to_BusinessPartnerAddress`,
      { Street: address.street, PostlCod1: address.zip, City1: address.city, Country: address.countryCode },
      { headers }
    );
    return this.mapAddress(res.data?.d ?? {});
  }

  private mapAddress(raw: Record<string, unknown>): Address {
    return {
      id: String(raw["AddressID"] ?? raw["id"] ?? ""),
      type: "shipping",
      street: String(raw["StreetName"] ?? raw["Street"] ?? ""),
      streetNumber: raw["HouseNumber"] ? String(raw["HouseNumber"]) : undefined,
      zip: String(raw["PostalCode"] ?? raw["PostlCod1"] ?? ""),
      city: String(raw["CityName"] ?? raw["City1"] ?? ""),
      countryCode: String(raw["Country"] ?? "DE"),
      isDefault: raw["IsDefaultAddress"] === true || raw["IsDefaultAddress"] === "X",
    };
  }

  async searchProducts(req: SearchRequest): Promise<SearchResult<Product>> {
    const entitySet = this.config.entitySets?.products ?? "MaterialSet";
    const filter = this.buildProductFilter(req.query);
    const top = req.pageSize ?? 20;
    const skip = ((req.page ?? 1) - 1) * top;

    const start = Date.now();
    const res = await this.http.get(`/${entitySet}`, {
      params: { $filter: filter, $top: top, $skip: skip, $format: "json", $inlinecount: "allpages" },
    });

    const raw = res.data?.d?.results ?? [];
    const total = Number(res.data?.d?.__count ?? raw.length);

    return {
      items: raw.map((r: Record<string, unknown>) => this.mapProduct(r)),
      total,
      page: req.page ?? 1,
      pageSize: top,
      hasMore: skip + raw.length < total,
      searchDurationMs: Date.now() - start,
    };
  }

  private buildProductFilter(query: string): string {
    const q = query.replace(/'/g, "''");
    return [
      `substringof('${q}', Matnr)`,
      `substringof('${q}', Maktx)`,
      `substringof('${q}', Ean11)`,
      `substringof('${q}', Mfrpn)`,
    ].join(" or ");
  }

  private mapProduct(raw: Record<string, unknown>): Product {
    return {
      id: String(raw["Matnr"] ?? ""),
      externalId: String(raw["Matnr"] ?? ""),
      tenantId: this.tenantId,
      articleNumber: String(raw["Matnr"] ?? ""),
      ean: raw["Ean11"] ? String(raw["Ean11"]) : undefined,
      designation: String(raw["Maktx"] ?? raw["MaterialName"] ?? ""),
      manufacturer: raw["Mfrnr"] ? String(raw["Mfrnr"]) : undefined,
      manufacturerArticleNumber: raw["Mfrpn"] ? String(raw["Mfrpn"]) : undefined,
      unit: String(raw["Meins"] ?? "ST"),
      basePrice: Number(raw["Stprs"] ?? 0),
      currency: String(raw["Waers"] ?? "EUR"),
      taxClass: String(raw["Mwskz"] ?? "STANDARD"),
      isActive: raw["Mmsta"] !== "02",
      source: "SAP_ODATA",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getProduct(id: string): Promise<Product> {
    const entitySet = this.config.entitySets?.products ?? "MaterialSet";
    const res = await this.http.get(`/${entitySet}('${id}')`, { params: { $format: "json" } });
    return this.mapProduct(res.data?.d ?? {});
  }

  async createProduct(data: Omit<Product, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Product> {
    const entitySet = this.config.entitySets?.products ?? "MaterialSet";
    const headers = await this.getMutationHeaders();
    const res = await this.http.post(
      `/${entitySet}`,
      { Maktx: data.designation, Meins: data.unit, Stprs: data.basePrice, Waers: data.currency },
      { headers }
    );
    return this.mapProduct(res.data?.d ?? {});
  }

  async getProductStock(productId: string, warehouseId?: string): Promise<StockInfo[]> {
    const entitySet = this.config.entitySets?.stock ?? "StockAvailabilitySet";
    const filter = warehouseId
      ? `Matnr eq '${productId}' and Lgort eq '${warehouseId}'`
      : `Matnr eq '${productId}'`;

    const res = await this.http.get(`/${entitySet}`, {
      params: { $filter: filter, $format: "json" },
    });
    const raw: Record<string, unknown>[] = res.data?.d?.results ?? [];
    return raw.map((r) => ({
      productId,
      warehouseId: String(r["Lgort"] ?? ""),
      warehouseName: String(r["Lgobe"] ?? ""),
      available: Number(r["Labst"] ?? 0),
      reserved: Number(r["Eisbe"] ?? 0),
      onOrder: Number(r["Insme"] ?? 0),
      total: Number(r["Umlme"] ?? 0),
      unit: String(r["Meins"] ?? "ST"),
      updatedAt: new Date().toISOString(),
    }));
  }

  async getProductPrice(productId: string, customerId?: string, quantity = 1): Promise<PriceInfo> {
    const entitySet = this.config.entitySets?.prices ?? "PricingSet";
    const res = await this.http.get(`/${entitySet}`, {
      params: {
        $filter: `Matnr eq '${productId}'${customerId ? ` and Kunnr eq '${customerId}'` : ""}`,
        $format: "json",
      },
    });
    const raw: Record<string, unknown> = res.data?.d?.results?.[0] ?? {};
    return {
      productId,
      customerId,
      quantity,
      netPrice: Number(raw["Netpr"] ?? raw["Kbetr"] ?? 0),
      grossPrice: Number(raw["Brprs"] ?? 0),
      discount: raw["Skopf"] ? Number(raw["Skopf"]) : undefined,
      currency: String(raw["Waers"] ?? "EUR"),
    };
  }

  async createQuote(draft: QuoteDraft): Promise<QuoteResult> {
    const headers = await this.getMutationHeaders();
    const payload = this.buildQuotePayload(draft);
    const res = await this.http.post("/QuotationSet", payload, { headers });
    const d = res.data?.d ?? {};
    return {
      erpQuoteId: String(d["Vbeln"] ?? ""),
      erpQuoteNumber: String(d["Vbeln"] ?? ""),
      pdfUrl: d["PdfUrl"] ? String(d["PdfUrl"]) : undefined,
      status: "created",
      createdAt: new Date().toISOString(),
    };
  }

  private buildQuotePayload(draft: QuoteDraft): Record<string, unknown> {
    return {
      Kunnr: draft.customerNumber,
      Waers: draft.currency,
      to_Item: {
        results: draft.lineItems.map((item, idx) => ({
          Posnr: String((idx + 1) * 10).padStart(6, "0"),
          Matnr: item.articleNumber,
          Kwmeng: item.quantity,
          Meins: item.unit,
          Kbetr: item.pricePerUnit,
        })),
      },
    };
  }

  async createSalesOrder(draft: QuoteDraft): Promise<OrderResult> {
    const headers = await this.getMutationHeaders();
    const payload = this.buildQuotePayload(draft);
    const res = await this.http.post("/SalesOrderSet", payload, { headers });
    const d = res.data?.d ?? {};
    return {
      erpOrderId: String(d["Vbeln"] ?? ""),
      erpOrderNumber: String(d["Vbeln"] ?? ""),
      status: "created",
      createdAt: new Date().toISOString(),
    };
  }

  async reserveStock(productId: string, quantity: number, warehouseId?: string): Promise<ReservationResult> {
    const headers = await this.getMutationHeaders();
    const res = await this.http.post(
      "/StockReservationSet",
      { Matnr: productId, Bdmng: quantity, Lgort: warehouseId ?? "0001" },
      { headers }
    );
    const d = res.data?.d ?? {};
    return {
      reservationId: String(d["Rsnum"] ?? ""),
      productId,
      quantity,
      warehouseId: warehouseId ?? "0001",
      status: d["Status"] === "FULL" ? "confirmed" : d["Status"] === "PARTIAL" ? "partial" : "failed",
      confirmedQuantity: Number(d["Bdmng"] ?? quantity),
    };
  }

  async createFollowUpTask(task: Omit<FollowUpTask, "id" | "createdAt" | "updatedAt">): Promise<FollowUpTask> {
    const headers = await this.getMutationHeaders();
    const res = await this.http.post(
      "/ActivitySet",
      { Kunnr: task.relatedCustomerId, Subject: task.title, Description: task.description, DueDate: task.dueDate },
      { headers }
    );
    const d = res.data?.d ?? {};
    return {
      ...task,
      id: String(d["Actid"] ?? crypto.randomUUID()),
      erpTaskId: String(d["Actid"] ?? ""),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createAppointment(appt: Omit<Appointment, "id" | "createdAt" | "updatedAt">): Promise<Appointment> {
    const headers = await this.getMutationHeaders();
    const res = await this.http.post(
      "/AppointmentSet",
      { Subject: appt.title, StartDatetime: appt.startAt, EndDatetime: appt.endAt, Location: appt.location ?? "" },
      { headers }
    );
    const d = res.data?.d ?? {};
    return {
      ...appt,
      id: String(d["Guid"] ?? crypto.randomUUID()),
      erpAppointmentId: String(d["Guid"] ?? ""),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createNote(note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> {
    const headers = await this.getMutationHeaders();
    const res = await this.http.post(
      "/NoteSet",
      { Kunnr: note.customerId ?? "", Content: note.content },
      { headers }
    );
    const d = res.data?.d ?? {};
    return {
      ...note,
      id: String(d["Guid"] ?? crypto.randomUUID()),
      erpNoteId: String(d["Guid"] ?? ""),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
