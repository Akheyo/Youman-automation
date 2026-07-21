import axios, { type AxiosInstance, isAxiosError } from "axios";
import { AuthError } from "../errors";
import type { PlentyLoginResponse } from "../types/PlentyConfig";

export interface PlentyLogger {
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface PlentyTokenManagerOptions {
  baseUrl: string;
  username: string;
  password: string;
  /** Injectable for tests; defaults to a bare axios instance. */
  http?: AxiosInstance;
  /** Injectable clock for tests; defaults to Date.now. */
  now?: () => number;
  logger?: PlentyLogger;
}

interface TokenState {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms at which the access token expires. */
  expiresAt: number;
}

/** Refresh proactively when less than 30 minutes of token lifetime remain. */
const PROACTIVE_REFRESH_WINDOW_MS = 30 * 60 * 1000;

/**
 * Holds one Plenty access token per connector instance (i.e. per tenant).
 *
 * Flow:
 *  - initial `POST /login` with username/password
 *  - proactive `POST /login/refresh` when < 30 min lifetime remain
 *  - reactive refresh on 401 via `handleUnauthorized()` (exactly one attempt,
 *    falling back to a full re-login; never loops)
 */
export class PlentyTokenManager {
  private readonly http: AxiosInstance;
  private readonly now: () => number;
  private readonly logger: PlentyLogger;
  private readonly username: string;
  private readonly password: string;

  private state: TokenState | null = null;
  /** Dedupes concurrent login/refresh attempts. */
  private inflight: Promise<TokenState> | null = null;

  constructor(opts: PlentyTokenManagerOptions) {
    this.http = opts.http ?? axios.create({ baseURL: opts.baseUrl, timeout: 30_000 });
    this.now = opts.now ?? Date.now;
    this.logger = opts.logger ?? console;
    this.username = opts.username;
    this.password = opts.password;
  }

  /** Returns a valid access token, logging in or refreshing as needed. */
  async getAccessToken(): Promise<string> {
    if (!this.state) {
      return (await this.runExclusive(() => this.login())).accessToken;
    }
    const remaining = this.state.expiresAt - this.now();
    if (remaining < PROACTIVE_REFRESH_WINDOW_MS) {
      this.logger.debug(`Plenty-Token läuft in ${Math.max(0, Math.round(remaining / 60000))} min ab – proaktiver Refresh`);
      return (await this.runExclusive(() => this.refreshOrRelogin())).accessToken;
    }
    return this.state.accessToken;
  }

  /**
   * Called after a 401 response. Tries one refresh, falls back to one
   * re-login. Throws AuthError if both fail – callers must not retry again.
   */
  async handleUnauthorized(): Promise<string> {
    this.logger.warn("Plenty-API meldete 401 – reaktiver Token-Refresh");
    return (await this.runExclusive(() => this.refreshOrRelogin())).accessToken;
  }

  /** Drops the cached token, forcing a fresh login on next use. */
  invalidate(): void {
    this.state = null;
  }

  private async runExclusive(fn: () => Promise<TokenState>): Promise<TokenState> {
    if (this.inflight) return this.inflight;
    this.inflight = fn().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async login(): Promise<TokenState> {
    try {
      const res = await this.http.post<PlentyLoginResponse>("/login", {
        username: this.username,
        password: this.password,
      });
      this.state = this.toState(res.data);
      this.logger.debug("Plenty-Login erfolgreich");
      return this.state;
    } catch (err) {
      this.state = null;
      throw new AuthError(`Plenty-Login fehlgeschlagen: ${describeAxiosError(err)}`);
    }
  }

  private async refreshOrRelogin(): Promise<TokenState> {
    const refreshToken = this.state?.refreshToken;
    if (refreshToken) {
      try {
        const res = await this.http.post<PlentyLoginResponse>(
          "/login/refresh",
          { refreshToken },
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );
        this.state = this.toState(res.data);
        this.logger.debug("Plenty-Token-Refresh erfolgreich");
        return this.state;
      } catch (err) {
        this.logger.warn(`Plenty-Token-Refresh fehlgeschlagen (${describeAxiosError(err)}) – kompletter Re-Login`);
      }
    }
    return this.login();
  }

  private toState(res: PlentyLoginResponse): TokenState {
    if (!res?.accessToken) {
      throw new AuthError("Plenty-Login-Response enthält keinen accessToken");
    }
    const expiresInMs = (res.expiresIn > 0 ? res.expiresIn : 24 * 3600) * 1000;
    return {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: this.now() + expiresInMs,
    };
  }
}

export function describeAxiosError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const detail = data && typeof data === "object" ? JSON.stringify(data).slice(0, 300) : String(data ?? "");
    return status ? `HTTP ${status}${detail ? ` – ${detail}` : ""}` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
