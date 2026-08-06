export type TenantStatus = "active" | "suspended" | "trial" | "cancelled";
export type TenantPlan = "starter" | "professional" | "enterprise";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  settings: TenantSettings;
  branding: TenantBranding;
  connectorConfig: ConnectorConfig | null;
}

export interface TenantSettings {
  tenantId: string;
  defaultLocale: string;
  defaultCurrency: string;
  timezone: string;
  dateFormat: string;
  enableOfflineMode: boolean;
  sessionTimeoutMinutes: number;
  maxRetryAttempts: number;
  retryBackoffMs: number;
  /** Nächste zu vergebende Angebotsnummer (im Admin konfigurierbar). */
  quoteNumberNext: number;
  /** Schrittweite, um die die Angebotsnummer je Angebot hochzählt. */
  quoteNumberStep: number;
  /**
   * true = Angebot wird im ERP angelegt, dessen Belegnummer wird verwendet.
   * false = lokale, lückenlose Nummer aus quoteNumberNext/-Step.
   */
  createQuoteInErp: boolean;
  /** Anrede auf dem Angebot, z.B. "Sehr geehrte Damen und Herren,". */
  quoteSalutation: string;
  /** Standard-Lieferdatum, wenn keine Position ein eigenes trägt. */
  quoteDeliveryDate: string;
  /** Zahlungsart auf dem Angebot, z.B. "Rechnung". */
  quotePaymentMethod: string;
  /** Zahlungsziel auf dem Angebot, z.B. "7 Tage netto". */
  quotePaymentTerms: string;
  /** Versandart auf dem Angebot, z.B. "Spedition oder Selbstabholung". */
  quoteShippingMethod: string;
}

export interface TenantBranding {
  tenantId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  appName: string;
  favicon: string | null;
  customCss: string | null;
}

export interface ConnectorConfig {
  id: string;
  tenantId: string;
  connectorType: ConnectorType;
  displayName: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ConnectorType = "SAP_RFC" | "SAP_ODATA" | "SAP_BAPI" | "MOCK" | "REST_GENERIC" | "PLENTY";
