/** Per-tenant configuration for the Plentymarkets connector. */
export interface PlentyConfig {
  /** Plenty instance REST base URL, e.g. https://xy123.my.plentysystems.com/rest */
  baseUrl: string;
  /** Plenty API user (Zugang "API"). */
  username: string;
  password: string;
  /** Plenty client (Mandant) id, required for order creation. */
  plentyId: number;
  defaultWarehouseId?: number;
  /**
   * ID des Verkaufspreises, der als NETTO-Preis für Angebote gilt.
   * In Plenty existieren meist mehrere Verkaufspreise (z.B. ID 1 = Shop-Preis
   * brutto, ID 2 = Netto/B2B). Ohne Angabe wird der Preis mit der NIEDRIGSTEN
   * salesPriceId genommen – das ist Plentys Standardpreis und je nach
   * Einrichtung ein Bruttopreis. Für B2B-Angebote gehört hier die ID des
   * Nettopreises hinein.
   */
  salesPriceId?: number;
  /** Defaults to EUR. */
  defaultCurrency?: string;
  defaultReferrerId?: number;
  /** Request timeout in ms, defaults to 30s. */
  timeout?: number;
}

// ─── Plenty REST response shapes (only the fields we consume) ─────────────────

export interface PlentyLoginResponse {
  accessToken: string;
  refreshToken: string;
  /** Seconds until accessToken expires (24h by default). */
  expiresIn: number;
  tokenType?: string;
}

export interface PlentyPagedResponse<T> {
  page: number;
  totalsCount: number;
  isLastPage: boolean;
  lastPageNumber?: number;
  firstOnPage?: number;
  lastOnPage?: number;
  itemsPerPage?: number;
  entries: T[];
}

export interface PlentyContactOption {
  id: number;
  typeId: number;
  subTypeId?: number;
  value: string;
  priority?: number;
}

export interface PlentyContact {
  id: number;
  externalId?: string | null;
  number?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  gender?: string | null;
  typeId?: number;
  createdAt?: string;
  updatedAt?: string;
  options?: PlentyContactOption[];
  addresses?: PlentyAddress[];
}

export interface PlentyAddressOption {
  id?: number;
  typeId: number;
  value: string;
}

export interface PlentyAddress {
  id: number;
  name1?: string | null;
  name2?: string | null;
  name3?: string | null;
  address1?: string | null; // street
  address2?: string | null; // house number
  address3?: string | null; // additional line
  postalCode?: string | null;
  town?: string | null;
  countryId?: number | null;
  isDefault?: boolean;
  /** Pivot info when fetched via a contact: which address types this address serves. */
  pivot?: { typeId?: number };
  options?: PlentyAddressOption[];
}

export interface PlentyVariationSalesPrice {
  variationId?: number;
  salesPriceId: number;
  price: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlentyVariationStock {
  variationId?: number;
  warehouseId: number;
  netStock: number;
  physicalStock?: number;
  reservedStock?: number;
  reorderLevel?: number;
}

export interface PlentyVariationBarcode {
  barcodeId?: number;
  code: string;
}

export interface PlentyItemText {
  lang?: string;
  /** Item name as delivered via with=itemTexts. */
  name?: string;
  name1?: string;
  name2?: string;
  name3?: string;
  previewDescription?: string;
  description?: string;
}

export interface PlentyVariation {
  id: number;
  itemId: number;
  number?: string | null; // variation number / SKU
  name?: string | null;
  model?: string | null; // manufacturer part number
  externalId?: string | null;
  isActive?: boolean;
  unitCombinationId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  item?: {
    id: number;
    manufacturerId?: number | null;
    texts?: PlentyItemText[];
  };
  /** Delivered via with=itemTexts (&lang=…). */
  itemTexts?: PlentyItemText[];
  variationSalesPrices?: PlentyVariationSalesPrice[];
  stock?: PlentyVariationStock[];
  variationBarcodes?: PlentyVariationBarcode[];
}

export interface PlentyOrderAmount {
  id?: number;
  isSystemCurrency?: boolean;
  currency: string;
  grossTotal?: number;
  netTotal?: number;
}

export interface PlentyOrderItem {
  id?: number;
  typeId?: number;
  itemVariationId: number;
  quantity: number;
  orderItemName: string;
  amounts?: Array<{ priceOriginalGross?: number; priceGross?: number; currency?: string }>;
}

export interface PlentyOrder {
  id: number;
  typeId: number;
  plentyId?: number;
  statusId?: number;
  statusName?: string;
  createdAt?: string;
  updatedAt?: string;
  orderItems?: PlentyOrderItem[];
  amounts?: PlentyOrderAmount[];
}

export interface PlentyWarehouseStockEntry {
  warehouseId: number;
  variationId: number;
  netStock: number;
  physicalStock?: number;
  reservedStock?: number;
}
