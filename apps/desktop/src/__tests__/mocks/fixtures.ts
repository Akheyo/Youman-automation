/**
 * Realistische Backend-Fixtures für die Smoke-Tests. Die Action-Configs sind
 * die ECHTEN Dateien aus configs/actions – die Tests prüfen also exakt die
 * Formulare, die auch in Produktion ausgeliefert werden.
 */
import createQuoteConfig from "../../../../../configs/actions/create-quote.json";
import createCustomerConfig from "../../../../../configs/actions/create-customer.json";

export const ACTION_DEFINITIONS = [createQuoteConfig, createCustomerConfig];

export const TENANT = {
  id: "tenant-demo",
  slug: "demo",
  name: "Demo GmbH",
  plan: "professional",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  settings: {
    tenantId: "tenant-demo",
    defaultLocale: "de-DE",
    defaultCurrency: "EUR",
    timezone: "Europe/Berlin",
    dateFormat: "DD.MM.YYYY",
    enableOfflineMode: true,
    sessionTimeoutMinutes: 480,
    maxRetryAttempts: 3,
    retryBackoffMs: 2000,
  },
  branding: {
    tenantId: "tenant-demo",
    primaryColor: "#3d3835",
    secondaryColor: "#6b5e57",
    accentColor: "#10B981",
    logoUrl: null,
    appName: "adept& Demo",
    favicon: null,
    customCss: null,
  },
  connectorConfig: null,
};

export const USER = {
  id: "user-admin",
  tenantId: "tenant-demo",
  email: "admin@demo.adept.de",
  firstName: "Max",
  lastName: "Admin",
  role: "TENANT_ADMIN",
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

export const LOGIN_RESPONSE = {
  accessToken: "access-token-1",
  refreshToken: "refresh-token-1",
  expiresIn: 3600,
  user: USER,
  tenant: TENANT,
};

export const CUSTOMER_SEARCH = {
  items: [
    { id: "118", name: "Bergmann Handels GmbH", customerNumber: "118", email: "einkauf@bergmann-handel.de" },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  hasMore: false,
  searchDurationMs: 12,
};

export const PRODUCT_SEARCH = {
  items: [
    {
      id: "1101",
      designation: "Trekkingrucksack Fjell 50 L schwarz",
      articleNumber: "TRK-500-BLK",
      basePrice: 74.9,
      currency: "EUR",
      unit: "ST",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  hasMore: false,
  searchDurationMs: 9,
};

export const QUOTE_EXECUTION = {
  id: "exec-1",
  tenantId: "tenant-demo",
  userId: "user-admin",
  actionId: "action-create-quote",
  actionName: "action-create-quote",
  status: "success",
  payload: {},
  result: {
    erpQuoteNumber: "2026-0001",
    erpQuoteId: "2026-0001",
    status: "created",
    document: { templateId: "tpl-1", documentType: "OFFER", data: { angebotsnummer: "2026-0001" } },
  },
  error: null,
  retryCount: 0,
  executedAt: "2026-07-23T10:00:00Z",
  completedAt: "2026-07-23T10:00:01Z",
  durationMs: 900,
  offlineQueueId: null,
};

export const CUSTOMER_EXECUTION = (name: string) => ({
  ...QUOTE_EXECUTION,
  id: "exec-2",
  actionId: "action-create-customer",
  actionName: "action-create-customer",
  result: { id: "9001", customerNumber: "9001", name, source: "PLENTY" },
});

export const SYNC_STATUS = {
  isOnline: true,
  lastSyncAt: null,
  pendingCount: 0,
  failedCount: 0,
  processingCount: 0,
  successCount: 0,
  isSyncing: false,
};

export const AUDIT_PAGE = {
  items: [
    {
      id: "log-1",
      tenantId: "tenant-demo",
      userId: "user-admin",
      userEmail: "admin@demo.adept.de",
      eventType: "ACTION_EXECUTED",
      resourceType: null,
      resourceId: null,
      description: "Aktion 'action-create-quote' erfolgreich ausgeführt",
      metadata: {
        actionId: "action-create-quote",
        result: {
          erpQuoteNumber: "2026-0001",
          document: { templateId: "tpl-1", documentType: "OFFER", data: {} },
        },
      },
      severity: "INFO",
      createdAt: "2026-07-23T10:00:01Z",
    },
  ],
  total: 1,
  totalPages: 1,
};

export const TEMPLATES = [
  {
    id: "tpl-1",
    name: "Angebot Standard",
    documentType: "OFFER",
    fileName: "beispiel-angebot.docx",
    placeholders: ["angebotsnummer", "kunde_name"],
    isDefault: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

export const CONNECTOR_CONFIG = {
  connectorType: "PLENTY",
  displayName: "Plentymarkets",
  enabled: true,
  config: { baseUrl: "https://demo.my.plentysystems.com", username: "api-user", plentyId: 1000 },
};
