import type {
  Address,
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
import { AuthError, NotFoundError, NotSupportedError, RateLimitError, ValidationError } from "../errors";
import { PlentyTokenManager, type PlentyLogger } from "../auth/PlentyTokenManager";
import { PlentyHttpClient } from "../http/PlentyHttpClient";
import type {
  PlentyAddress,
  PlentyConfig,
  PlentyContact,
  PlentyOrder,
  PlentyPagedResponse,
  PlentyVariation,
  PlentyWarehouseStockEntry,
} from "../types/PlentyConfig";
import {
  ADDRESS_TYPE_BILLING,
  ADDRESS_TYPE_SHIPPING,
  ORDER_TYPE_OFFER,
  ORDER_TYPE_SALES_ORDER,
  buildAddressPayload,
  buildContactPayload,
  buildPlentyNames,
  buildOrderPayload,
  mapContactToCustomer,
  mapPlentyAddress,
  mapVariationToProduct,
  mapVariationStock,
  pickDefaultSalesPrice,
} from "../mapping";

// itemTexts carries the item names (variation.name is usually empty);
// requires the lang parameter alongside.
const VARIATION_WITH = "itemTexts,variationSalesPrices,stock,variationBarcodes";
const VARIATION_LANG = "de";

export interface PlentyConnectorDeps {
  /** Injectable for tests. */
  httpClient?: PlentyHttpClient;
  logger?: PlentyLogger;
}

/**
 * Plentymarkets REST connector.
 *
 * Interface gaps (see package README):
 *  - createProduct: item creation in Plenty is a multi-step flow (item +
 *    variation + texts + prices) with no single sensible endpoint → NotSupportedError
 *  - reserveStock: Plenty has no standalone stock-reservation API → NotSupportedError
 *  - createFollowUpTask / createAppointment / createNote: Plenty's REST API has
 *    no generic CRM task/appointment/note objects → NotSupportedError
 */
export class PlentyConnector implements IErpConnector {
  readonly connectorType = "PLENTY";
  readonly tenantId: string;

  private readonly cfg: PlentyConfig;
  private readonly http: PlentyHttpClient;
  private readonly logger: PlentyLogger;

  constructor(tenantId: string, config: PlentyConfig, deps: PlentyConnectorDeps = {}) {
    this.tenantId = tenantId;
    this.logger = deps.logger ?? console;

    const missing = (["baseUrl", "username", "password", "plentyId"] as const).filter((k) => !config?.[k]);
    if (missing.length > 0) {
      throw new ValidationError(`Plenty-Connector-Config unvollständig, fehlende Felder: ${missing.join(", ")}`);
    }
    this.cfg = { ...config, baseUrl: normalizeBaseUrl(config.baseUrl) };

    this.http =
      deps.httpClient ??
      new PlentyHttpClient({
        baseUrl: this.cfg.baseUrl,
        ...(this.cfg.timeout !== undefined ? { timeout: this.cfg.timeout } : {}),
        tokenManager: new PlentyTokenManager({
          baseUrl: this.cfg.baseUrl,
          username: this.cfg.username,
          password: this.cfg.password,
          ...(deps.logger ? { logger: deps.logger } : {}),
        }),
        ...(deps.logger ? { logger: deps.logger } : {}),
      });
  }

  async healthCheck(): Promise<ConnectorHealthResult> {
    const start = Date.now();
    try {
      await this.http.get<PlentyPagedResponse<PlentyContact>>("/accounts/contacts", { itemsPerPage: 1, page: 1 });
      return { healthy: true, latencyMs: Date.now() - start, message: "Plentymarkets-API erreichbar" };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ─── Customers ──────────────────────────────────────────────────────────────

  async searchCustomers(req: SearchRequest): Promise<SearchResult<Customer>> {
    const start = Date.now();
    const page = req.page ?? 1;
    const pageSize = req.pageSize ?? 20;
    const query = req.query.trim();

    // Heuristic: '@' → email search, else Plenty full-text search, which
    // covers name, company, contact number and email in one go.
    const params: Record<string, unknown> = { page, itemsPerPage: pageSize, with: "addresses" };
    if (query.includes("@")) params["email"] = query;
    else if (query) params["fullText"] = query;

    const res = await this.http.get<PlentyPagedResponse<PlentyContact>>("/accounts/contacts", params);
    this.logger.debug(
      `Plenty-Kundensuche '${query}' (${query.includes("@") ? "email" : "fullText"}) → ${res.entries.length} von ${res.totalsCount} Treffern`
    );
    const items = res.entries.map((c) => mapContactToCustomer(c, this.tenantId));
    return {
      items,
      total: res.totalsCount,
      page: res.page,
      pageSize,
      hasMore: !res.isLastPage,
      searchDurationMs: Date.now() - start,
    };
  }

  async getCustomer(id: string): Promise<Customer> {
    const contact = await this.http.get<PlentyContact>(`/accounts/contacts/${encodeURIComponent(id)}`, {
      with: "addresses",
    });
    return mapContactToCustomer(contact, this.tenantId);
  }

  async createCustomer(data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Customer> {
    // Plenty dedupliziert Kontakte serverseitig über die E-Mail (Instanz-
    // Einstellung): ein zweites Anlegen mit gleicher E-Mail würde still den
    // bestehenden Kontakt aktualisieren statt einen neuen anzulegen. Deshalb
    // vorab prüfen und den Nutzer klar informieren, statt stumm zu überschreiben.
    if (data.email) {
      const existing = await this.http.get<PlentyPagedResponse<PlentyContact>>("/accounts/contacts", {
        email: data.email,
        itemsPerPage: 1,
        page: 1,
      });
      const match = existing.entries?.[0];
      if (match) {
        throw new ValidationError(
          `Ein Kontakt mit der E-Mail ${data.email} existiert in Plentymarkets bereits (Kunden-ID ${match.id}). ` +
            `Bitte eine andere E-Mail verwenden oder den bestehenden Kunden nutzen – sonst würde der vorhandene Kontakt überschrieben.`
        );
      }
    }

    const payload = buildContactPayload(data);
    // In Produktion sichtbar (debug wird auf log-Level geroutet): belegt, ob
    // name1 (Firma) bzw. name2/name3 (Person) gefüllt bei Plenty ankommen.
    this.logger.debug(`Kontakt-Payload an Plenty: ${JSON.stringify(payload)}`);
    const contact = await this.http.post<PlentyContact>("/accounts/contacts", payload);
    // debug wird backend-seitig auf log-Level geroutet (ConnectorsService).
    this.logger.debug(`Kontakt in Plenty angelegt: id=${contact.id} (${data.isCompany === false ? "Person" : "Firma"})`);

    // "Firma"-Feld: In Plenty ist die Firma KEIN Kontaktfeld, sondern ein
    // eigenes Account-Objekt (companyName), das per contactId mit dem Kontakt
    // verknüpft wird (ContactAccountRepositoryContract.createAccount). Nur so
    // erscheint der Firmenname im Feld "Firma" statt im Nachnamen. Best-effort:
    // schlägt die Verknüpfung fehl, bleibt der Kontakt trotzdem bestehen – der
    // Firmenname liegt dann weiterhin als Adress-name1 vor.
    if (data.isCompany !== false && data.name) {
      try {
        const account = await this.http.post<{ id?: number }>(
          `/accounts/contacts/${contact.id}/account`,
          { companyName: data.name }
        );
        this.logger.debug(
          `Firma-Account verknüpft: contactId=${contact.id}, accountId=${account?.id ?? "?"}, companyName=${data.name}`
        );
      } catch (err) {
        this.logger.warn(
          `Firma-Account für Kontakt ${contact.id} konnte nicht angelegt werden ` +
            `(${err instanceof Error ? err.message : String(err)}). Der Firmenname bleibt über die Adresse (name1) erhalten.`
        );
      }
    }

    // Plenty-Adressen verlangen ebenfalls name1/name2/name3 – ohne diese wirft
    // der Adress-POST denselben Namensfehler. Wir übernehmen die Kunden-Namen
    // (Firma → name1, Person → name2/name3) in jedes Adress-Payload.
    const nameFields = buildPlentyNames(data);
    const created: PlentyAddress[] = [];
    for (const address of data.addresses ?? []) {
      const addressPayload = { ...buildAddressPayload(address), ...nameFields };
      this.logger.debug(`Adress-Payload an Plenty: ${JSON.stringify(addressPayload)}`);
      const res = await this.http.post<PlentyAddress>(
        `/accounts/contacts/${contact.id}/addresses`,
        addressPayload
      );
      this.logger.debug(`Adresse angelegt: id=${res.id}`);
      created.push({ ...res, pivot: { typeId: address.type === "shipping" ? ADDRESS_TYPE_SHIPPING : ADDRESS_TYPE_BILLING } });
    }

    return mapContactToCustomer({ ...contact, addresses: created }, this.tenantId);
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload["lastName"] = data.name;
    if (data.name2 !== undefined) payload["firstName"] = data.name2;
    if (data.externalId !== undefined) payload["externalId"] = data.externalId;
    const contact = await this.http.put<PlentyContact>(`/accounts/contacts/${encodeURIComponent(id)}`, payload);
    return mapContactToCustomer(contact, this.tenantId);
  }

  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    const res = await this.http.get<PlentyAddress[] | PlentyPagedResponse<PlentyAddress>>(
      `/accounts/contacts/${encodeURIComponent(customerId)}/addresses`
    );
    const entries = Array.isArray(res) ? res : res.entries;
    return entries.map((a) => mapPlentyAddress(a));
  }

  async createCustomerAddress(customerId: string, address: Omit<Address, "id">): Promise<Address> {
    const res = await this.http.post<PlentyAddress>(
      `/accounts/contacts/${encodeURIComponent(customerId)}/addresses`,
      buildAddressPayload(address)
    );
    return mapPlentyAddress({
      ...res,
      pivot: { typeId: address.type === "shipping" ? ADDRESS_TYPE_SHIPPING : ADDRESS_TYPE_BILLING },
    });
  }

  // ─── Products (Plenty variations) ───────────────────────────────────────────

  async searchProducts(req: SearchRequest): Promise<SearchResult<Product>> {
    const start = Date.now();
    const page = req.page ?? 1;
    const pageSize = req.pageSize ?? 20;
    const query = req.query.trim();

    // Heuristic: EAN-like digit strings → barcode; other numeric queries →
    // variation number, then variation id, then item id; compact codes →
    // variation number (SKU) with itemName fallback; everything else → itemName.
    const base: Record<string, unknown> = { page, itemsPerPage: pageSize, with: VARIATION_WITH, lang: VARIATION_LANG };
    let res: PlentyPagedResponse<PlentyVariation>;
    if (/^\d{8}$|^\d{12,14}$/.test(query)) {
      res = await this.trySearchVariations({ ...base, barcode: query }, query, "barcode");
    } else if (/^\d+$/.test(query)) {
      // Multi-track search: variation id, Plenty item id and variation number
      // (SKU) in parallel; results are merged and deduped by variation id with
      // exact-ID hits first. A failing or empty track never blocks the others.
      // The verify guards only accept entries actually matching the id filter
      // (Plenty silently ignores unknown filters and would return everything).
      const idNum = Number(query);
      const [byVariationId, byItemId, byNumber] = await Promise.all([
        this.trySearchVariations({ ...base, id: idNum }, query, "id", (v) => v.id === idNum),
        this.trySearchVariations({ ...base, itemId: idNum }, query, "itemId", (v) => v.itemId === idNum),
        this.trySearchVariations({ ...base, numberFuzzy: query }, query, "numberFuzzy"),
      ]);
      const merged = dedupeVariations([...byVariationId.entries, ...byItemId.entries, ...byNumber.entries]);
      if (merged.length > 0) {
        const pageEntries = merged.slice(0, pageSize);
        res = {
          page: 1,
          totalsCount: merged.length,
          isLastPage: merged.length <= pageSize,
          entries: pageEntries,
          itemsPerPage: pageSize,
        };
        this.logger.debug(`Plenty-Artikelsuche '${query}' (kombiniert) → ${merged.length} eindeutige Treffer`);
      } else {
        // Part numbers often live inside the item name (e.g. "Ford 1815863 …").
        res = await this.trySearchVariations({ ...base, itemName: query }, query, "itemName");
      }
    } else if (query && !/\s/.test(query)) {
      res = await this.trySearchVariations({ ...base, numberFuzzy: query }, query, "numberFuzzy");
      if (res.entries.length === 0) {
        res = await this.trySearchVariations({ ...base, itemName: query }, query, "itemName");
      }
    } else {
      res = await this.searchVariations({ ...base, ...(query ? { itemName: query } : {}) }, query, "itemName");
    }

    const items = res.entries.map((v) =>
      mapVariationToProduct(v, this.tenantId, {
        currency: this.cfg.defaultCurrency ?? "EUR",
        ...(this.cfg.defaultWarehouseId !== undefined ? { defaultWarehouseId: this.cfg.defaultWarehouseId } : {}),
        ...(this.cfg.salesPriceId !== undefined ? { salesPriceId: this.cfg.salesPriceId } : {}),
        ...(this.cfg.salesPriceIsGross !== undefined ? { salesPriceIsGross: this.cfg.salesPriceIsGross } : {}),
        ...(this.cfg.vatRate !== undefined ? { vatRate: this.cfg.vatRate } : {}),
      })
    );
    return {
      items,
      total: res.totalsCount,
      page: res.page,
      pageSize,
      hasMore: !res.isLastPage,
      searchDurationMs: Date.now() - start,
    };
  }

  async getProduct(id: string): Promise<Product> {
    const variation = await this.getVariation(id);
    return mapVariationToProduct(variation, this.tenantId, {
      currency: this.cfg.defaultCurrency ?? "EUR",
      ...(this.cfg.defaultWarehouseId !== undefined ? { defaultWarehouseId: this.cfg.defaultWarehouseId } : {}),
      ...(this.cfg.salesPriceId !== undefined ? { salesPriceId: this.cfg.salesPriceId } : {}),
      ...(this.cfg.salesPriceIsGross !== undefined ? { salesPriceIsGross: this.cfg.salesPriceIsGross } : {}),
      ...(this.cfg.vatRate !== undefined ? { vatRate: this.cfg.vatRate } : {}),
    });
  }

  async createProduct(): Promise<Product> {
    throw new NotSupportedError(
      "createProduct",
      "Artikel-Anlage in Plentymarkets ist ein mehrstufiger Prozess (Item + Variante + Texte + Preise) und wird über die Plenty-Oberfläche gepflegt"
    );
  }

  async getProductStock(productId: string, warehouseId?: string): Promise<StockInfo[]> {
    const variation = await this.getVariation(productId);
    let stock = mapVariationStock(variation.stock ?? [], productId);

    // Fallback: dedicated stock endpoint when the variation query carried no
    // stock data but a concrete warehouse is known.
    const wh = warehouseId ?? (this.cfg.defaultWarehouseId !== undefined ? String(this.cfg.defaultWarehouseId) : undefined);
    if (stock.length === 0 && wh !== undefined) {
      const res = await this.http.get<PlentyPagedResponse<PlentyWarehouseStockEntry>>(
        `/stockmanagement/warehouses/${encodeURIComponent(wh)}/stock/variations`,
        { variationId: Number(productId) }
      );
      stock = res.entries.map((e) => ({
        productId,
        warehouseId: String(e.warehouseId),
        warehouseName: `Lager ${e.warehouseId}`,
        available: e.netStock,
        reserved: e.reservedStock ?? 0,
        onOrder: 0,
        total: e.physicalStock ?? e.netStock,
        unit: "ST",
        updatedAt: new Date().toISOString(),
      }));
    }

    return warehouseId !== undefined ? stock.filter((s) => s.warehouseId === warehouseId) : stock;
  }

  async getProductPrice(productId: string, _customerId?: string, quantity = 1): Promise<PriceInfo> {
    const variation = await this.getVariation(productId);
    const net = pickDefaultSalesPrice(variation, this.cfg.salesPriceId) ?? 0;
    return {
      productId,
      quantity,
      netPrice: net,
      grossPrice: Math.round(net * 1.19 * 100) / 100,
      currency: this.cfg.defaultCurrency ?? "EUR",
    };
  }

  // ─── Quotes / Orders ────────────────────────────────────────────────────────

  async createQuote(draft: QuoteDraft): Promise<QuoteResult> {
    const order = await this.createPlentyOrder(draft, ORDER_TYPE_OFFER);
    return {
      erpQuoteId: String(order.id),
      erpQuoteNumber: String(order.id),
      status: order.statusName ?? "created",
      createdAt: order.createdAt ?? new Date().toISOString(),
    };
  }

  async createSalesOrder(draft: QuoteDraft): Promise<OrderResult> {
    const order = await this.createPlentyOrder(draft, ORDER_TYPE_SALES_ORDER);
    return {
      erpOrderId: String(order.id),
      erpOrderNumber: String(order.id),
      status: order.statusName ?? "created",
      createdAt: order.createdAt ?? new Date().toISOString(),
    };
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

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async searchVariations(
    params: Record<string, unknown>,
    query?: string,
    mode?: string
  ): Promise<PlentyPagedResponse<PlentyVariation>> {
    const raw = await this.http.get<PlentyPagedResponse<PlentyVariation> | PlentyVariation[]>(
      "/items/variations",
      params
    );
    // Some Plenty endpoints answer with a bare array instead of a paged object.
    const res: PlentyPagedResponse<PlentyVariation> = Array.isArray(raw)
      ? { page: 1, totalsCount: raw.length, isLastPage: true, entries: raw, lastPageNumber: 1, firstOnPage: 1, lastOnPage: raw.length, itemsPerPage: raw.length }
      : { ...raw, entries: raw.entries ?? [] };
    if (mode !== undefined) {
      this.logger.debug(`Plenty-Artikelsuche '${query}' (${mode}) → ${res.entries.length} von ${res.totalsCount} Treffern`);
    }
    return res;
  }

  /**
   * One step of the product-search fallback chain: a failing search mode
   * (e.g. an unsupported filter answered with HTTP 400/404) must not kill the
   * whole search – it logs and falls through to the next mode. Auth and
   * rate-limit problems still surface, retrying other modes won't fix those.
   * The optional verifier drops entries Plenty returned despite not matching
   * the filter (observed when a filter parameter is silently ignored).
   */
  private async trySearchVariations(
    params: Record<string, unknown>,
    query: string,
    mode: string,
    verify?: (v: PlentyVariation) => boolean
  ): Promise<PlentyPagedResponse<PlentyVariation>> {
    try {
      const res = await this.searchVariations(params, query, mode);
      if (verify && res.entries.length > 0) {
        const matching = res.entries.filter(verify);
        if (matching.length !== res.entries.length) {
          this.logger.warn(
            `Plenty-Artikelsuche '${query}' (${mode}): ${res.entries.length - matching.length} Treffer verworfen, die nicht zum Filter passen`
          );
          return { ...res, entries: matching, totalsCount: matching.length, isLastPage: true };
        }
      }
      return res;
    } catch (err) {
      if (err instanceof AuthError || err instanceof RateLimitError) throw err;
      this.logger.warn(
        `Plenty-Artikelsuche '${query}' (${mode}) fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) – versuche nächsten Suchmodus`
      );
      return { page: 1, totalsCount: 0, isLastPage: true, entries: [], lastPageNumber: 1, firstOnPage: 0, lastOnPage: 0, itemsPerPage: 0 };
    }
  }

  private async getVariation(id: string): Promise<PlentyVariation> {
    const idNum = Number(id);
    const res = await this.searchVariations({ id: idNum, with: VARIATION_WITH, lang: VARIATION_LANG, itemsPerPage: 1, page: 1 });
    // Accept only an exact id match – never a random entry from an ignored filter.
    const variation = res.entries.find((v) => v.id === idNum);
    if (!variation) throw new NotFoundError(`Plenty-Variante '${id}' nicht gefunden`);
    return variation;
  }

  private async createPlentyOrder(draft: QuoteDraft, orderTypeId: number): Promise<PlentyOrder> {
    // Resolve billing/shipping address ids from the contact; the draft's
    // delivery address (if chosen in the UI) overrides the shipping default.
    let billingAddressId: number | undefined;
    let shippingAddressId: number | undefined;
    try {
      const res = await this.http.get<PlentyAddress[] | PlentyPagedResponse<PlentyAddress>>(
        `/accounts/contacts/${encodeURIComponent(draft.customerId)}/addresses`
      );
      const addresses = Array.isArray(res) ? res : res.entries;
      const billing = addresses.find((a) => a.pivot?.typeId === ADDRESS_TYPE_BILLING) ?? addresses.find((a) => a.isDefault) ?? addresses[0];
      const shipping = addresses.find((a) => a.pivot?.typeId === ADDRESS_TYPE_SHIPPING) ?? billing;
      billingAddressId = billing?.id;
      shippingAddressId = shipping?.id;
    } catch (err) {
      // Order creation without address relations is still valid in Plenty –
      // aber protokollieren: ein Auth-/Netzwerkproblem soll hier nicht wie
      // "Kontakt hat einfach keine Adressen" aussehen.
      this.logger.warn(
        `Adress-Lookup für Kontakt ${draft.customerId} fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) – Beleg wird ohne Adress-Relationen angelegt`
      );
    }
    if (draft.deliveryAddressId) {
      shippingAddressId = Number(draft.deliveryAddressId);
    }

    const payload = buildOrderPayload(draft, orderTypeId, this.cfg, {
      ...(billingAddressId !== undefined ? { billingAddressId } : {}),
      ...(shippingAddressId !== undefined ? { shippingAddressId } : {}),
    });
    return this.http.post<PlentyOrder>("/orders", payload);
  }
}

/** Accepts instance URLs with or without the /rest suffix and trailing slashes. */
export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/rest") ? trimmed : `${trimmed}/rest`;
}

/** Merges multi-track search results, keeping the first occurrence per variation id. */
function dedupeVariations(entries: PlentyVariation[]): PlentyVariation[] {
  const seen = new Set<number>();
  const result: PlentyVariation[] = [];
  for (const v of entries) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    result.push(v);
  }
  return result;
}
