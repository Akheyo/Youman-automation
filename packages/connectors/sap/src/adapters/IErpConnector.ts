import type {
  Customer,
  Product,
  PriceInfo,
  StockInfo,
  QuoteDraft,
  FollowUpTask,
  Appointment,
  Note,
  Address,
  Country,
  SearchResult,
  SearchRequest,
} from "@youman/shared";

/**
 * Connector interface – all ERP adapters must implement this.
 * This ensures UI and backend are completely decoupled from the ERP specifics.
 */
export interface IErpConnector {
  readonly connectorType: string;
  readonly tenantId: string;

  // Health
  healthCheck(): Promise<ConnectorHealthResult>;

  // Customer operations
  searchCustomers(request: SearchRequest): Promise<SearchResult<Customer>>;
  getCustomer(id: string): Promise<Customer>;
  createCustomer(data: Omit<Customer, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Customer>;
  updateCustomer(id: string, data: Partial<Customer>): Promise<Customer>;
  getCustomerAddresses(customerId: string): Promise<Address[]>;

  /**
   * Laender, die das angebundene System kennt.
   *
   * Optional: Nicht jedes System kann seine Laenderliste ausgeben. Fehlt die
   * Methode, greift die feste Liste im Backend. Bewusst nicht verpflichtend,
   * damit die uebrigen Connectoren unveraendert bleiben.
   */
  getCountries?(): Promise<Country[]>;
  createCustomerAddress(customerId: string, address: Omit<Address, "id">): Promise<Address>;

  // Product operations
  searchProducts(request: SearchRequest): Promise<SearchResult<Product>>;
  getProduct(id: string): Promise<Product>;
  createProduct(data: Omit<Product, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<Product>;
  getProductStock(productId: string, warehouseId?: string): Promise<StockInfo[]>;
  getProductPrice(productId: string, customerId?: string, quantity?: number): Promise<PriceInfo>;

  // Quote / Order operations
  createQuote(draft: QuoteDraft): Promise<QuoteResult>;
  createSalesOrder(draft: QuoteDraft): Promise<OrderResult>;
  reserveStock(productId: string, quantity: number, warehouseId?: string): Promise<ReservationResult>;

  // CRM operations
  createFollowUpTask(task: Omit<FollowUpTask, "id" | "createdAt" | "updatedAt">): Promise<FollowUpTask>;
  createAppointment(appointment: Omit<Appointment, "id" | "createdAt" | "updatedAt">): Promise<Appointment>;
  createNote(note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note>;
}

export interface ConnectorHealthResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface QuoteResult {
  erpQuoteId: string;
  erpQuoteNumber: string;
  pdfUrl?: string;
  status: string;
  createdAt: string;
}

export interface OrderResult {
  erpOrderId: string;
  erpOrderNumber: string;
  status: string;
  createdAt: string;
}

export interface ReservationResult {
  reservationId: string;
  productId: string;
  quantity: number;
  warehouseId: string;
  status: "confirmed" | "partial" | "failed";
  confirmedQuantity: number;
}
