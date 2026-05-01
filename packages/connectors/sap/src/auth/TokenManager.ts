import axios, { type AxiosInstance } from "axios";

/**
 * Shared token-acquisition strategies used by REST connectors.
 *
 * Three flavours of "give me a fresh access token":
 *  - OAuth2 client_credentials (server-to-server, fully automated)
 *  - OAuth2 refresh_token (use a long-lived refresh token to mint short-lived access tokens)
 *  - "login" (POST username/password to a system-specific endpoint, e.g. Plentymarkets /rest/login)
 *
 * The TokenManager caches the current access token in-process, refreshing
 * eagerly ~30s before its declared expiry. Failures fall back to a fresh
 * acquisition attempt; if that also fails the caller gets the underlying error
 * (and the connector returns the request unauthenticated, leading to a clean
 * 401 the user can act on).
 */

export type OAuthClientCredentialsAuth = {
  type: "oauth2_client_credentials";
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  /** Optional extra body params, e.g. {"audience": "..."} for Auth0. */
  extraParams?: Record<string, string>;
};

export type OAuthRefreshAuth = {
  type: "oauth2_refresh";
  tokenUrl: string;
  clientId?: string;
  clientSecret?: string;
  /** Initial access token — used until expiry, then refreshed. */
  accessToken?: string;
  /** Long-lived refresh token. */
  refreshToken: string;
  /** Optional access-token expiry (epoch ms) if the admin entered a fresh one manually. */
  accessTokenExpiresAt?: number;
};

export type LoginTokenAuth = {
  type: "login";
  /** URL relative to baseUrl, or absolute. POST {username, password}. */
  loginPath: string;
  username: string;
  password: string;
  /** Path inside response JSON to extract token. Default "accessToken". */
  accessTokenField?: string;
  /** Optional path to refresh token (Plentymarkets returns one too). */
  refreshTokenField?: string;
  /** Path to expiry seconds. Default "expiresIn". */
  expiresInField?: string;
  /** Optional refresh endpoint (Plentymarkets has /rest/login/refresh). */
  refreshPath?: string;
};

export type AutoRefreshAuth =
  | OAuthClientCredentialsAuth
  | OAuthRefreshAuth
  | LoginTokenAuth;

interface CachedToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

const REFRESH_SAFETY_WINDOW_MS = 30_000;

export class TokenManager {
  private cached: CachedToken | null = null;
  private inflight: Promise<CachedToken> | null = null;

  constructor(
    private readonly auth: AutoRefreshAuth,
    private readonly baseUrl: string,
    private readonly http: AxiosInstance = axios.create({ timeout: 15_000 }),
  ) {}

  /** Get a fresh access token, refreshing/acquiring if needed. */
  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + REFRESH_SAFETY_WINDOW_MS) {
      return this.cached.accessToken;
    }
    // Coalesce concurrent refreshes
    if (!this.inflight) {
      this.inflight = this.acquire().finally(() => {
        this.inflight = null;
      });
    }
    const tok = await this.inflight;
    this.cached = tok;
    return tok.accessToken;
  }

  /** Force re-acquisition (e.g. after a 401 from the upstream API). */
  async forceRefresh(): Promise<string> {
    this.cached = null;
    return this.getAccessToken();
  }

  // ─── Private acquisition logic ─────────────────────────────────────────────

  private async acquire(): Promise<CachedToken> {
    switch (this.auth.type) {
      case "oauth2_client_credentials":
        return this.acquireClientCredentials(this.auth);
      case "oauth2_refresh":
        return this.acquireRefresh(this.auth);
      case "login":
        return this.acquireLogin(this.auth);
    }
  }

  private async acquireClientCredentials(a: OAuthClientCredentialsAuth): Promise<CachedToken> {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      ...(a.scope ? { scope: a.scope } : {}),
      ...(a.extraParams ?? {}),
    });
    const res = await this.http.post(a.tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${a.clientId}:${a.clientSecret}`).toString("base64"),
      },
    });
    return parseTokenResponse(res.data);
  }

  private async acquireRefresh(a: OAuthRefreshAuth): Promise<CachedToken> {
    // If we have a fresh access token from initial config, use it once
    if (a.accessToken && a.accessTokenExpiresAt && a.accessTokenExpiresAt > Date.now()) {
      return {
        accessToken: a.accessToken,
        refreshToken: a.refreshToken,
        expiresAt: a.accessTokenExpiresAt,
      };
    }
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.cached?.refreshToken ?? a.refreshToken,
      ...(a.clientId ? { client_id: a.clientId } : {}),
      ...(a.clientSecret ? { client_secret: a.clientSecret } : {}),
    });
    const res = await this.http.post(a.tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return parseTokenResponse(res.data);
  }

  private async acquireLogin(a: LoginTokenAuth): Promise<CachedToken> {
    const url = a.loginPath.startsWith("http") ? a.loginPath : `${this.baseUrl}${a.loginPath}`;

    // Prefer refreshPath if we already have a refresh token and the system supports it.
    if (a.refreshPath && this.cached?.refreshToken) {
      const refreshUrl = a.refreshPath.startsWith("http") ? a.refreshPath : `${this.baseUrl}${a.refreshPath}`;
      try {
        const res = await this.http.post(refreshUrl, { refresh_token: this.cached.refreshToken }, {
          headers: { "Content-Type": "application/json" },
        });
        return extractFromLoginResponse(res.data, a);
      } catch {
        // Fall through to fresh login below
      }
    }

    const res = await this.http.post(
      url,
      { username: a.username, password: a.password },
      { headers: { "Content-Type": "application/json" } },
    );
    return extractFromLoginResponse(res.data, a);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTokenResponse(data: unknown): CachedToken {
  const d = (data ?? {}) as Record<string, unknown>;
  const access = String(d.access_token ?? d.accessToken ?? "");
  const refresh = d.refresh_token ?? d.refreshToken;
  const expiresIn = Number(d.expires_in ?? d.expiresIn ?? 3600);
  if (!access) throw new Error("Token response did not contain access_token");
  return {
    accessToken: access,
    refreshToken: typeof refresh === "string" ? refresh : undefined,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

function extractFromLoginResponse(data: unknown, a: LoginTokenAuth): CachedToken {
  const d = (data ?? {}) as Record<string, unknown>;
  const tokenField = a.accessTokenField ?? "accessToken";
  const refreshField = a.refreshTokenField;
  const expiresField = a.expiresInField ?? "expiresIn";
  const access = String(getPath(d, tokenField) ?? "");
  if (!access) throw new Error(`Login response missing field '${tokenField}'`);
  const refresh = refreshField ? getPath(d, refreshField) : undefined;
  const expires = Number(getPath(d, expiresField) ?? 3600);
  return {
    accessToken: access,
    refreshToken: typeof refresh === "string" ? refresh : undefined,
    expiresAt: Date.now() + expires * 1000,
  };
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}
