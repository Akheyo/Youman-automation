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

export type ConnectorType = "SAP_RFC" | "SAP_ODATA" | "SAP_BAPI" | "MOCK" | "REST_GENERIC";
