export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    field?: string;
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
