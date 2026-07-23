export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ApiError {
  success: false;
  error: {
    /** Maschinenlesbarer Fehlercode, z. B. ERP_UNREACHABLE, VALIDATION_FAILED. */
    code: string;
    /** Deutsche, endnutzertaugliche Meldung. */
    message: string;
    /**
     * Strukturierte, nutzer-relevante Zusatzdaten (z. B. Feldfehler-Listen).
     * Technische Interna (Stacktraces, Roh-Fehler) landen hier NIE – die
     * werden ausschließlich serverseitig geloggt.
     */
    details?: Record<string, unknown>;
    field?: string;
    /** Feldbezogene Fehlermeldungen für die Anzeige am Formularfeld. */
    fields?: Record<string, string[]>;
    /** Kennung zur Korrelation mit den Server-Logs (auch im Header X-Correlation-Id). */
    correlationId?: string;
  };
  requestId?: string;
}

export interface ResponseMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: Required<ResponseMeta>;
}

export interface SearchRequest {
  query: string;
  fields?: string[];
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchDurationMs: number;
}
