export type SapConnectionType = "RFC" | "ODATA_V2" | "ODATA_V4" | "BAPI_REST";

export interface SapConfig {
  connectionType: SapConnectionType;
  baseUrl: string;
  client: string;
  language: string;
  timeout: number;
  auth: SapAuthConfig;
  entitySets?: SapEntitySetMapping;
}

export type SapAuthType = "basic" | "oauth2" | "saml";

export interface SapAuthConfig {
  type: SapAuthType;
  username?: string;
  password?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
}

export interface SapEntitySetMapping {
  customers?: string;
  products?: string;
  prices?: string;
  stock?: string;
  quotations?: string;
  salesOrders?: string;
  activities?: string;
}

export interface SapODataResponse<T> {
  d: {
    results?: T[];
    [key: string]: unknown;
  };
}

export interface SapError {
  code: string;
  message: { lang: string; value: string };
  innererror?: unknown;
}
