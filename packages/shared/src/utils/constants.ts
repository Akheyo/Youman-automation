export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

/**
 * Kontrakt-Version zwischen Desktop-App und Backend. Bei einem BREAKING
 * Change an API-Shape/Fehlerstruktur/Auth-Fluss hochzählen – Backend liefert
 * sie über GET /health, die App vergleicht beim Start und warnt bei
 * Abweichung ("App und Server passen nicht zusammen") statt mit kryptischen
 * Folgefehlern zu scheitern.
 */
export const API_CONTRACT_VERSION = 2;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY_MS = 2000;

export const TOKEN_EXPIRY_SECONDS = 3600; // 1h
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export const OFFLINE_QUEUE_DB_NAME = "youman_offline_queue.db";
export const LOCAL_SETTINGS_KEY = "youman_local_settings";
export const TENANT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export const SAP_MAX_RESULTS = 50;
export const SEARCH_DEBOUNCE_MS = 300;
export const MIN_SEARCH_CHARS = 2;

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_COUNTRY = "DE";

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Fehlercodes: siehe types/error-codes.ts (ERROR_CODES) – die frühere,
// ungenutzte Tabelle mit kryptischen Codes (AUTH_001, SYS_001, …) wurde durch
// sprechende Codes ersetzt, die Backend-Filter und Client-Meldungs-Mapping teilen.

/**
 * Standardtexte auf dem Angebot. Entsprechen exakt den Werten, die früher
 * fest im Code standen – damit sich am erzeugten Dokument nichts ändert,
 * solange ein Mandant sie nicht in den Einstellungen anpasst.
 */
export const QUOTE_TEXT_DEFAULTS = {
  quoteSalutation: "Sehr geehrte Damen und Herren,",
  quoteDeliveryDate: "ab sofort",
  quotePaymentMethod: "Rechnung",
  quotePaymentTerms: "7 Tage netto",
  quoteShippingMethod: "Spedition oder Selbstabholung",
} as const;

/** Sprachen, in denen ein Angebot erzeugt werden kann. */
export const QUOTE_LANGUAGES = ["de", "en"] as const;
export type QuoteLanguage = (typeof QUOTE_LANGUAGES)[number];

/**
 * Englische Entsprechungen der Standardtexte.
 *
 * Bewusst fest hinterlegt und nicht pro Mandant einstellbar: Die deutschen
 * Texte sind einstellbar, weil sie zum Briefbogen passen müssen. Für die
 * englische Fassung gibt es bisher keinen Bedarf an Abweichungen – kommt er,
 * wird daraus dieselbe Mechanik wie bei den deutschen Texten.
 */
export const QUOTE_TEXT_DEFAULTS_EN: Record<keyof typeof QUOTE_TEXT_DEFAULTS, string> = {
  quoteSalutation: "Dear Sir or Madam,",
  quoteDeliveryDate: "immediately",
  quotePaymentMethod: "Invoice",
  quotePaymentTerms: "7 days net",
  quoteShippingMethod: "Forwarding agent or collection",
};

/**
 * Englische Entsprechung der im Formular auswählbaren Zahlungsarten.
 *
 * Die Auswahl steht als deutscher Klartext in der Aktionskonfiguration, damit
 * ein Mandant weitere Zahlungsarten ergänzen kann, ohne dass die App neu
 * ausgeliefert werden muss. Auf einem englischen Angebot stünde sonst ein
 * deutsches Wort. Unbekannte Einträge bleiben unverändert – ein selbst
 * ergänzter Text ist besser als eine falsche Übersetzung.
 */
const PAYMENT_METHODS_EN: Record<string, string> = {
  Rechnung: "Invoice",
  Vorauszahlung: "Prepayment",
  Vorkasse: "Prepayment",
  Nachnahme: "Cash on delivery",
  Lastschrift: "Direct debit",
};

export function translatePaymentMethod(value: string, language: QuoteLanguage): string {
  if (language !== "en") return value;
  return PAYMENT_METHODS_EN[value.trim()] ?? value;
}
