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
