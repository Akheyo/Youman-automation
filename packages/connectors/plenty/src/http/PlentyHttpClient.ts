import axios, { type AxiosInstance, type AxiosResponse, type Method, isAxiosError } from "axios";
import {
  AuthError,
  ConnectionError,
  NotFoundError,
  PlentyConnectorError,
  RateLimitError,
  ServerError,
  toValidationError,
} from "../errors";
import { PlentyTokenManager, describeAxiosError, type PlentyLogger } from "../auth/PlentyTokenManager";

export interface PlentyRequest {
  method: Method;
  url: string;
  params?: Record<string, unknown>;
  data?: unknown;
}

export interface PlentyHttpClientOptions {
  baseUrl: string;
  tokenManager: PlentyTokenManager;
  timeout?: number;
  /** Injectable for tests; defaults to a bare axios instance. */
  http?: AxiosInstance;
  logger?: PlentyLogger;
  /** Injectable for tests; defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests; defaults to Math.random (jitter source). */
  random?: () => number;
  /** Injectable clock for tests. */
  now?: () => number;
}

const MAX_RETRIES_429 = 3;
const MAX_RETRIES_5XX = 2;
/** Transportfehler (Netzwerk/Timeout) werden NUR für GET wiederholt. */
const MAX_RETRIES_NETWORK = 2;
const BACKOFF_BASE_MS = 1000;
/** Throttle when fewer than 10% of the period's calls remain. */
const THROTTLE_THRESHOLD = 0.1;

/**
 * Wraps every Plenty REST call with:
 *  - Bearer-token injection (via PlentyTokenManager)
 *  - rate-limit header tracking (X-Plenty-*-Limit / -Calls-Left / -Decay)
 *    and proactive throttling when a period is nearly exhausted
 *  - 429 handling with exponential backoff + jitter (max 3 retries)
 *  - 5xx handling with backoff (max 2 retries)
 *  - exactly one reactive re-auth on 401 (no endless auth retry)
 *  - mapping of Plenty error responses onto typed errors
 */
export class PlentyHttpClient {
  private readonly http: AxiosInstance;
  private readonly tokens: PlentyTokenManager;
  private readonly logger: PlentyLogger;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  /** Epoch ms until which requests must wait because a limit is nearly exhausted. */
  private throttledUntil = 0;

  constructor(opts: PlentyHttpClientOptions) {
    this.http = opts.http ?? axios.create({ baseURL: opts.baseUrl, timeout: opts.timeout ?? 30_000 });
    this.tokens = opts.tokenManager;
    this.logger = opts.logger ?? console;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>({ method: "GET", url, ...(params ? { params } : {}) });
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>({ method: "POST", url, data });
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>({ method: "PUT", url, data });
  }

  async request<T>(req: PlentyRequest): Promise<T> {
    let retries429 = 0;
    let retries5xx = 0;
    let retriesNetwork = 0;
    let reauthDone = false;

    // Bounded loop: every path either returns, throws, or increments one of
    // the retry counters, all of which are capped.
    for (;;) {
      await this.waitIfThrottled();

      const token = await this.tokens.getAccessToken();
      try {
        const res = await this.http.request<T>({
          method: req.method,
          url: req.url,
          ...(req.params ? { params: req.params } : {}),
          ...(req.data !== undefined ? { data: req.data } : {}),
          headers: { Authorization: `Bearer ${token}` },
        });
        this.trackRateLimit(res.headers as Record<string, unknown>);
        return res.data;
      } catch (err) {
        // Nicht-Axios-Fehler sind Programmierfehler – unverändert durchreichen.
        if (!isAxiosError(err)) {
          throw err;
        }
        // Transportfehler (keine Antwort: Timeout, Connection-Reset, DNS):
        // GET ist idempotent und darf wiederholt werden. Schreibende Verben
        // NICHT – der Request könnte den Server bereits erreicht haben; vor
        // Duplikaten schützt dort die Idempotenz-Schicht im Backend.
        if (!err.response) {
          const transport = describeAxiosError(err);
          if (String(req.method).toUpperCase() === "GET" && retriesNetwork < MAX_RETRIES_NETWORK) {
            retriesNetwork += 1;
            const delay = this.backoffDelay(retriesNetwork);
            this.logger.warn(
              `Plenty-Transportfehler auf GET ${req.url} (${transport}) – Retry ${retriesNetwork}/${MAX_RETRIES_NETWORK} in ${delay} ms`
            );
            await this.sleep(delay);
            continue;
          }
          throw new ConnectionError(
            `Plenty-API nicht erreichbar (${req.method} ${req.url}): ${transport}`
          );
        }
        const { status, headers, data } = err.response as AxiosResponse;
        this.trackRateLimit(headers as Record<string, unknown>);

        if (status === 401) {
          if (reauthDone) {
            throw new AuthError(`Plenty-API lehnt Authentifizierung dauerhaft ab (${req.method} ${req.url})`);
          }
          reauthDone = true;
          await this.tokens.handleUnauthorized();
          continue;
        }

        if (status === 429) {
          if (retries429 >= MAX_RETRIES_429) {
            throw new RateLimitError(
              `Plenty-Rate-Limit erreicht, ${MAX_RETRIES_429} Wiederholungen erfolglos (${req.method} ${req.url})`,
              this.decaySecondsFrom(headers as Record<string, unknown>)
            );
          }
          retries429 += 1;
          const delay = this.backoffDelay(retries429);
          this.logger.warn(`Plenty 429 auf ${req.method} ${req.url} – Retry ${retries429}/${MAX_RETRIES_429} in ${delay} ms`);
          await this.sleep(delay);
          continue;
        }

        if (status >= 500) {
          if (retries5xx >= MAX_RETRIES_5XX) {
            throw new ServerError(`Plenty-API-Fehler HTTP ${status} nach ${MAX_RETRIES_5XX} Wiederholungen (${req.method} ${req.url})`);
          }
          retries5xx += 1;
          const delay = this.backoffDelay(retries5xx);
          this.logger.warn(`Plenty HTTP ${status} auf ${req.method} ${req.url} – Retry ${retries5xx}/${MAX_RETRIES_5XX} in ${delay} ms`);
          await this.sleep(delay);
          continue;
        }

        if (status === 404) {
          throw new NotFoundError(`Plenty-Ressource nicht gefunden: ${req.method} ${req.url}`);
        }

        if (status === 422 || status === 400) {
          throw toValidationError(data, `Plenty-Request ungültig (HTTP ${status}, ${req.method} ${req.url})`);
        }

        // Unerwarteter HTTP-Status: typisiert werfen, damit das Backend ihn
        // als ERP_ERROR klassifizieren kann statt als generischen 500.
        throw new PlentyConnectorError(
          "PLENTY_HTTP_ERROR",
          `Plenty-API-Fehler: ${describeAxiosError(err)} (${req.method} ${req.url})`
        );
      }
    }
  }

  // ─── Rate-limit bookkeeping ─────────────────────────────────────────────────

  /**
   * Evaluates all X-Plenty-*-Limit / -Calls-Left / -Decay header triples
   * (global long/short period and route-specific ones). When any period has
   * less than 10% of its calls left, subsequent requests wait out its decay.
   */
  private trackRateLimit(headers: Record<string, unknown> | undefined): void {
    if (!headers) return;
    for (const key of Object.keys(headers)) {
      const match = /^x-plenty-(.+)-limit$/i.exec(key);
      if (!match) continue;
      const period = match[1]!;
      const limit = toNumber(headers[key]);
      const callsLeft = toNumber(findHeader(headers, `x-plenty-${period}-calls-left`));
      const decay = toNumber(findHeader(headers, `x-plenty-${period}-decay`));
      if (limit === undefined || callsLeft === undefined || limit <= 0) continue;

      if (callsLeft < limit * THROTTLE_THRESHOLD) {
        const waitMs = Math.max(1, decay ?? 1) * 1000;
        const until = this.now() + waitMs;
        if (until > this.throttledUntil) {
          this.throttledUntil = until;
          this.logger.warn(
            `Plenty-Rate-Limit '${period}' fast ausgeschöpft (${callsLeft}/${limit}) – drossele Requests für ${Math.round(waitMs / 1000)} s`
          );
        }
      }
    }
  }

  private async waitIfThrottled(): Promise<void> {
    const waitMs = this.throttledUntil - this.now();
    if (waitMs > 0) {
      this.logger.warn(`Warte ${Math.round(waitMs / 1000)} s bis Plenty-Rate-Limit-Fenster erneuert ist`);
      await this.sleep(waitMs);
      this.throttledUntil = 0;
    }
  }

  private decaySecondsFrom(headers: Record<string, unknown>): number | undefined {
    for (const key of Object.keys(headers)) {
      if (/^x-plenty-.+-decay$/i.test(key)) {
        const v = toNumber(headers[key]);
        if (v !== undefined) return v;
      }
    }
    return undefined;
  }

  /** Exponential backoff with full jitter: base * 2^(attempt-1) * (0.5..1.5). */
  private backoffDelay(attempt: number): number {
    const exp = BACKOFF_BASE_MS * 2 ** (attempt - 1);
    return Math.round(exp * (0.5 + this.random()));
  }
}

function findHeader(headers: Record<string, unknown>, name: string): unknown {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
