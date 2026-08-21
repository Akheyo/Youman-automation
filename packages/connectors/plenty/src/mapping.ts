import type { Address, Customer, Product, QuoteDraft, StockInfo } from "@youman/shared";
import type {
  PlentyAddress,
  PlentyConfig,
  PlentyContact,
  PlentyOrder,
  PlentyVariation,
  PlentyVariationStock,
} from "./types/PlentyConfig";

// Plenty stores contact communication data as typed options.
// Plenty-System-typeIds: 1 = Telefon, 2 = E-Mail, 4 = Webseite/URL.
// (Vorher stand PHONE fälschlich auf 4 -> Telefonnummern landeten in "Webseite".)
export const CONTACT_OPTION_TYPE_EMAIL = 2;
export const CONTACT_OPTION_TYPE_PHONE = 1;
export const CONTACT_OPTION_TYPE_WEBSITE = 4;
// Sub-Typen für Telefon (Plenty-Standard): 1 = privat, 4 = mobil.
export const CONTACT_OPTION_SUBTYPE_PRIVATE = 1;
export const CONTACT_OPTION_SUBTYPE_MOBILE = 4;
// E-Mail-Sub-Typ (Plenty-Standard): 4 = privat.
export const CONTACT_OPTION_SUBTYPE_EMAIL_PRIVATE = 4;

// Plenty address relation types on orders/contacts.
export const ADDRESS_TYPE_BILLING = 1;
export const ADDRESS_TYPE_SHIPPING = 2;

// Plenty order types.
export const ORDER_TYPE_SALES_ORDER = 1;
export const ORDER_TYPE_OFFER = 4;

/** Minimal ISO-3166 numeric→alpha2 mapping for the markets Plenty ships with. */
/**
 * Notnagel-Zuordnung Plenty-Landes-ID zu ISO-Code.
 *
 * Massgeblich ist die Liste, die das jeweilige Plenty-System selbst liefert
 * (siehe PlentyConnector.getCountries) - Plenty pflegt dort deutlich mehr
 * Laender als diese 30. Diese Tabelle greift nur, solange die Liste noch nicht
 * geladen ist oder der Abruf scheitert.
 */
const COUNTRY_ID_TO_CODE: Record<number, string> = {
  1: "DE", 2: "AT", 3: "BE", 4: "CH", 5: "CY", 6: "CZ", 7: "DK", 8: "ES", 9: "EE",
  10: "FR", 11: "FI", 12: "GB", 13: "GR", 14: "HU", 15: "IT", 16: "IE", 17: "LU",
  18: "LV", 19: "LT", 20: "MT", 21: "NO", 22: "NL", 23: "PT", 24: "PL", 25: "SE",
  26: "SG", 27: "SK", 28: "SI", 29: "US", 30: "AU",
};
const COUNTRY_CODE_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(COUNTRY_ID_TO_CODE).map(([id, code]) => [code, Number(id)])
);

/** Landes-ID zu einem ISO-Code, bevorzugt aus der Liste des Plenty-Systems. */
export function countryIdFor(code: string, live?: Record<string, number>): number | undefined {
  const key = code.trim().toUpperCase();
  return live?.[key] ?? COUNTRY_CODE_TO_ID[key];
}

/** ISO-Code zu einer Landes-ID, bevorzugt aus der Liste des Plenty-Systems. */
export function countryCodeFor(id: number, live?: Record<number, string>): string | undefined {
  return live?.[id] ?? COUNTRY_ID_TO_CODE[id];
}

// ─── Plenty → internal model ──────────────────────────────────────────────────

export function mapContactToCustomer(contact: PlentyContact, tenantId: string): Customer {
  const email =
    contact.email ??
    contact.options?.find((o) => o.typeId === CONTACT_OPTION_TYPE_EMAIL)?.value;
  const phoneOptions = contact.options?.filter((o) => o.typeId === CONTACT_OPTION_TYPE_PHONE) ?? [];
  const phone = phoneOptions.find((o) => o.subTypeId !== CONTACT_OPTION_SUBTYPE_MOBILE)?.value;
  const mobile = phoneOptions.find((o) => o.subTypeId === CONTACT_OPTION_SUBTYPE_MOBILE)?.value;

  // fullName kommt bei Firmenkontakten ohne Ansprechpartner als " " (ein
  // Leerzeichen) zurück – ungetrimmt wäre das ein "gültiger" Name und der
  // Kunde hätte in der Liste gar keine Bezeichnung.
  const personName = (
    contact.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
  ).trim();

  // Der Plenty-KONTAKT hat kein Firmenfeld – firstName/lastName sind bei einer
  // Firma der Ansprechpartner. Der Firmenname steht in der Rechnungsadresse
  // als name1 (so schreibt ihn auch buildPlentyNames beim Anlegen). Ohne das
  // stünde auf dem Angebot der Privatname statt der Firma.
  const company = companyNameFrom(contact.addresses ?? []);
  const name = company || personName;

  return {
    id: String(contact.id),
    externalId: contact.externalId ?? String(contact.id),
    tenantId,
    customerNumber: contact.number ?? String(contact.id),
    name: name || `Kontakt ${contact.id}`,
    ...(company ? { isCompany: true } : {}),
    ...(contact.firstName ? { firstName: contact.firstName } : {}),
    ...(contact.lastName ? { lastName: contact.lastName } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(mobile ? { mobile } : {}),
    currency: "EUR",
    isActive: true,
    source: "PLENTY",
    addresses: dedupeAddresses(contact.addresses ?? []).map((a) => mapPlentyAddress(a)),
    createdAt: contact.createdAt ?? new Date().toISOString(),
    updatedAt: contact.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Firmenname eines Kontakts, sofern vorhanden.
 *
 * Bevorzugt die Standard-Rechnungsadresse, dann irgendeine Rechnungsadresse,
 * dann die erste Adresse überhaupt – Plenty pflegt den Firmennamen dort als
 * name1. Adressen ohne name1 (Privatpersonen: Name steht in name2/name3)
 * liefern nichts zurück.
 */
export function companyNameFrom(addresses: PlentyAddress[]): string {
  const billing = addresses.filter((a) => a.pivot?.typeId !== ADDRESS_TYPE_SHIPPING);
  const candidate =
    billing.find((a) => a.isDefault && a.name1) ??
    billing.find((a) => a.name1) ??
    addresses.find((a) => a.name1);
  return candidate?.name1?.trim() ?? "";
}

/**
 * Entfernt Mehrfachnennungen derselben Adresse.
 *
 * Plenty liefert eine Adresse einmal pro Adresstyp aus – dieselbe id also
 * sowohl als Rechnungs- als auch als Lieferadresse. Ungefiltert stünde jede
 * Anschrift doppelt in der Auswahl. Die Rechnungsvariante gewinnt, weil das
 * Angebot an die Rechnungsanschrift geht.
 */
export function dedupeAddresses(addresses: PlentyAddress[]): PlentyAddress[] {
  const byId = new Map<number, PlentyAddress>();
  for (const address of addresses) {
    const existing = byId.get(address.id);
    if (!existing || (existing.pivot?.typeId === ADDRESS_TYPE_SHIPPING && address.pivot?.typeId !== ADDRESS_TYPE_SHIPPING)) {
      byId.set(address.id, address);
    }
  }
  return [...byId.values()];
}

export function mapPlentyAddress(
  addr: PlentyAddress,
  countryCodes?: Record<number, string>
): Address {
  const type = addr.pivot?.typeId === ADDRESS_TYPE_SHIPPING ? "shipping" : "billing";
  return {
    id: String(addr.id),
    type,
    street: addr.address1 ?? "",
    ...(addr.address2 ? { streetNumber: addr.address2 } : {}),
    ...(addr.address3 ? { additionalLine: addr.address3 } : {}),
    zip: addr.postalCode ?? "",
    city: addr.town ?? "",
    countryCode: (addr.countryId != null ? countryCodeFor(addr.countryId, countryCodes) : undefined) ?? "DE",
    isDefault: addr.isDefault ?? false,
    ...(addr.name1 ? { contactName: addr.name1 } : {}),
  };
}

/**
 * Plenty separates items (Artikel) and variations (Varianten); only variations
 * are orderable. A variation therefore maps to our Product, with `id` being the
 * variation id (used later as itemVariationId on orders).
 */
export function mapVariationToProduct(
  variation: PlentyVariation,
  tenantId: string,
  opts: {
    currency?: string;
    defaultWarehouseId?: number;
    salesPriceId?: number;
    salesPriceIsGross?: boolean;
    vatRate?: number;
  } = {}
): Product {
  const currency = opts.currency ?? "EUR";
  // Item names arrive via with=itemTexts (field "name"); prefer German texts.
  const texts = variation.itemTexts ?? variation.item?.texts ?? [];
  const itemText = texts.find((t) => t.lang === "de") ?? texts[0];
  const designation =
    variation.name || itemText?.name || itemText?.name1 || `Variante ${variation.id}`;
  const ean = variation.variationBarcodes?.[0]?.code;
  const price = toNetPrice(
    pickDefaultSalesPrice(variation, opts.salesPriceId),
    opts.salesPriceIsGross ?? false,
    opts.vatRate
  );
  const stockInfos = mapVariationStock(variation.stock ?? [], String(variation.id));
  const preferredStock =
    (opts.defaultWarehouseId !== undefined
      ? stockInfos.find((s) => s.warehouseId === String(opts.defaultWarehouseId))
      : undefined) ?? stockInfos[0];

  return {
    id: String(variation.id),
    externalId: variation.externalId ?? String(variation.id),
    tenantId,
    // Artikel-ID = Plenty itemId (die 5-stellige Artikelnummer), NICHT die
    // Varianten-Nummer/SKU (variation.number). Diese ID erscheint u.a. in der
    // Angebots-Positionstabelle. Fallback auf SKU bzw. Varianten-ID.
    articleNumber: variation.itemId ? String(variation.itemId) : (variation.number ?? String(variation.id)),
    ...(ean ? { ean } : {}),
    designation,
    ...(variation.model ? { manufacturerArticleNumber: variation.model } : {}),
    ...(itemText?.previewDescription ? { description: itemText.previewDescription } : {}),
    unit: "ST",
    basePrice: price ?? 0,
    currency,
    taxClass: "STANDARD",
    isActive: variation.isActive ?? true,
    source: "PLENTY",
    ...(preferredStock ? { stockInfo: preferredStock } : {}),
    createdAt: variation.createdAt ?? new Date().toISOString(),
    updatedAt: variation.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Liefert den Verkaufspreis der Variante.
 *
 * Mit `preferredSalesPriceId` wird GENAU dieser Verkaufspreis genommen – so
 * stellt ein Mandant sicher, dass im Angebot der NETTO-Preis steht und nicht
 * Plentys Standardpreis (der je nach Einrichtung brutto ist).
 *
 * Ohne Angabe – oder wenn die gewünschte ID an der Variante nicht gepflegt
 * ist – gilt wie bisher: niedrigste salesPriceId gewinnt. Der Fallback ist
 * bewusst: Ein Angebot soll nicht daran scheitern, dass an einem einzelnen
 * Artikel der Netto-Preis fehlt.
 */
export function pickDefaultSalesPrice(
  variation: PlentyVariation,
  preferredSalesPriceId?: number
): number | undefined {
  const prices = [...(variation.variationSalesPrices ?? [])].sort((a, b) => a.salesPriceId - b.salesPriceId);
  if (preferredSalesPriceId !== undefined) {
    const preferred = prices.find((p) => p.salesPriceId === preferredSalesPriceId);
    if (preferred) return preferred.price;
  }
  return prices[0]?.price;
}

/** Steuersatz, wenn der Mandant keinen eigenen hinterlegt hat. */
export const DEFAULT_VAT_RATE = 19;

/**
 * Rechnet einen Bruttopreis in den Nettopreis um, der ins Angebot gehört.
 *
 * In Plenty ist je nach Einrichtung nicht klar, ob ein Verkaufspreis brutto
 * oder netto gepflegt ist – deshalb entscheidet das der Mandant über
 * `salesPriceIsGross`. Ist der Preis bereits netto (Standard), bleibt er
 * unverändert. Gerundet wird auf zwei Nachkommastellen, damit die Summen im
 * Angebot aufgehen.
 *
 * Unplausible Steuersätze (nicht endlich, negativ oder ab 100 %) fallen auf
 * den Standardsatz zurück: Lieber ein nachvollziehbarer Preis als eine
 * Division durch null.
 */
export function toNetPrice(
  price: number | undefined,
  isGross: boolean,
  vatRate?: number
): number | undefined {
  if (price === undefined || !isGross) return price;
  const rate = vatRate !== undefined && Number.isFinite(vatRate) && vatRate >= 0 && vatRate < 100
    ? vatRate
    : DEFAULT_VAT_RATE;
  return Math.round((price / (1 + rate / 100)) * 100) / 100;
}

export function mapVariationStock(entries: PlentyVariationStock[], productId: string): StockInfo[] {
  return entries.map((s) => ({
    productId,
    warehouseId: String(s.warehouseId),
    warehouseName: `Lager ${s.warehouseId}`,
    available: s.netStock,
    reserved: s.reservedStock ?? 0,
    onOrder: 0,
    total: s.physicalStock ?? s.netStock,
    unit: "ST",
    updatedAt: new Date().toISOString(),
  }));
}

// ─── Internal model → Plenty payloads ────────────────────────────────────────

export function buildContactPayload(
  data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">
): Record<string, unknown> {
  const options: Array<Record<string, unknown>> = [];
  if (data.email) {
    options.push({ typeId: CONTACT_OPTION_TYPE_EMAIL, subTypeId: CONTACT_OPTION_SUBTYPE_EMAIL_PRIVATE, value: data.email, priority: 0 });
  }
  if (data.phone) {
    options.push({ typeId: CONTACT_OPTION_TYPE_PHONE, subTypeId: CONTACT_OPTION_SUBTYPE_PRIVATE, value: data.phone, priority: 0 });
  }
  if (data.mobile) {
    options.push({ typeId: CONTACT_OPTION_TYPE_PHONE, subTypeId: CONTACT_OPTION_SUBTYPE_MOBILE, value: data.mobile, priority: 0 });
  }
  return {
    // typeId 1 = customer
    typeId: 1,
    referrerId: 1,
    ...buildContactNames(data),
    ...(options.length > 0 ? { options } : {}),
  };
}

/**
 * Namensfelder für den KONTAKT (/rest/accounts/contacts). Plenty-Kontakte
 * nutzen firstName/lastName (NICHT name1/name2/name3 – das sind Adressfelder).
 *
 * WICHTIG: Der Kontakt hat KEIN eigenes "Firma"-Feld. In Plenty ist die "Firma"
 * ein eigenes Account-Objekt (companyName), das per contactId mit dem Kontakt
 * verknüpft wird (ContactAccountRepositoryContract.createAccount, siehe
 * PlentyConnector.createCustomer). Der Firmenname darf deshalb NICHT als
 * lastName gesendet werden – sonst landet er im Nachnamen statt im Firma-Feld.
 *
 * Person: firstName = Vorname, lastName = Nachname.
 * Firma:  firstName/lastName = OPTIONALER Ansprechpartner. Ist kein
 *         Ansprechpartner angegeben, dient der Firmenname als lastName-Fallback,
 *         damit der Kontakt einen anzeigbaren Namen hat (die Firma selbst kommt
 *         zusätzlich über den Account ins Firma-Feld).
 */
export function buildContactNames(data: {
  name?: string;
  firstName?: string;
  lastName?: string;
  isCompany?: boolean;
}): Record<string, string> {
  // Privatperson: Vor-/Nachname sind der Kunde.
  if (data.isCompany === false) {
    return {
      ...(data.firstName ? { firstName: data.firstName } : {}),
      ...(data.lastName ? { lastName: data.lastName } : {}),
    };
  }
  // Firma mit Ansprechpartner: dessen Vor-/Nachname wird der Kontaktname.
  if (data.firstName || data.lastName) {
    return {
      ...(data.firstName ? { firstName: data.firstName } : {}),
      ...(data.lastName ? { lastName: data.lastName } : {}),
    };
  }
  // Firma ohne Ansprechpartner: Firmenname als Fallback-Nachname, damit der
  // Kontakt benannt/auffindbar ist. Das Firma-Feld füllt der Account separat.
  return data.name ? { lastName: data.name } : {};
}

/**
 * Namensfelder für die ADRESSE (…/addresses). Plenty-Adressen verlangen
 * mindestens eines von name1/name2/name3.
 * Firma:  name1 = Firmenname. Person: name2 = Vorname, name3 = Nachname.
 */
export function buildPlentyNames(data: {
  name?: string;
  firstName?: string;
  lastName?: string;
  isCompany?: boolean;
}): Record<string, string> {
  if (data.isCompany === false && (data.firstName || data.lastName)) {
    return {
      ...(data.firstName ? { name2: data.firstName } : {}),
      ...(data.lastName ? { name3: data.lastName } : {}),
    };
  }
  return data.name ? { name1: data.name } : {};
}

export function buildAddressPayload(
  address: Omit<Address, "id">,
  countryIds?: Record<string, number>
): Record<string, unknown> {
  return {
    ...(address.contactName ? { name1: address.contactName } : {}),
    address1: address.street,
    ...(address.streetNumber ? { address2: address.streetNumber } : {}),
    ...(address.additionalLine ? { address3: address.additionalLine } : {}),
    postalCode: address.zip,
    town: address.city,
    // Kein stilles Ausweichen auf Deutschland mehr: Ein unbekanntes Land legte
    // den Kunden bisher wortlos in DE an - der Fehler faellt erst beim Versand
    // auf. Lieber hier abbrechen und den Code nennen.
    countryId: (() => {
      const id = countryIdFor(address.countryCode, countryIds);
      if (id === undefined) {
        throw new Error(
          `Land "${address.countryCode}" ist in diesem Plenty-System nicht bekannt – bitte ein anderes Land wählen.`
        );
      }
      return id;
    })(),
    typeId: address.type === "shipping" ? ADDRESS_TYPE_SHIPPING : ADDRESS_TYPE_BILLING,
  };
}

export interface OrderAddressRefs {
  billingAddressId?: number;
  shippingAddressId?: number;
}

export function buildOrderPayload(
  draft: QuoteDraft,
  orderTypeId: number,
  cfg: Pick<PlentyConfig, "plentyId" | "defaultCurrency" | "defaultReferrerId">,
  addresses: OrderAddressRefs = {}
): Record<string, unknown> {
  const currency = draft.currency || cfg.defaultCurrency || "EUR";
  const addressRelations: Array<Record<string, unknown>> = [];
  if (addresses.billingAddressId !== undefined) {
    addressRelations.push({ typeId: ADDRESS_TYPE_BILLING, addressId: addresses.billingAddressId });
  }
  if (addresses.shippingAddressId !== undefined) {
    addressRelations.push({ typeId: ADDRESS_TYPE_SHIPPING, addressId: addresses.shippingAddressId });
  }

  return {
    typeId: orderTypeId,
    plentyId: cfg.plentyId,
    ...(cfg.defaultReferrerId !== undefined ? { referrerId: cfg.defaultReferrerId } : {}),
    orderItems: draft.lineItems.map((item) => ({
      itemVariationId: Number(item.productId),
      quantity: item.quantity,
      orderItemName: item.designation,
      ...(cfg.defaultReferrerId !== undefined ? { referrerId: cfg.defaultReferrerId } : {}),
      amounts: [
        {
          priceOriginalGross: grossUnitPrice(item.pricePerUnit, item.discount),
          currency,
        },
      ],
    })),
    relations: [
      { referenceType: "contact", referenceId: Number(draft.customerId), relation: "receiver" },
    ],
    ...(addressRelations.length > 0 ? { addressRelations } : {}),
  };
}

/**
 * Our line items carry net unit prices; Plenty's priceOriginalGross expects the
 * gross price. Applies the line discount and German standard VAT (19%). Known
 * limitation (see README): per-item tax classes are not resolved against
 * Plenty's VAT configuration.
 */
function grossUnitPrice(netUnitPrice: number, discountPercent?: number): number {
  const discounted = netUnitPrice * (1 - (discountPercent ?? 0) / 100);
  return Math.round(discounted * 1.19 * 100) / 100;
}

export function orderNumberOf(order: PlentyOrder): string {
  return String(order.id);
}
