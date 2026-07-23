/**
 * Zentrale Wiederholungs-Hilfsfunktion mit exponentiellem Backoff plus Jitter.
 *
 * Wiederholt AUSSCHLIESSLICH transiente Fehler: Netzwerkfehler, Timeout,
 * HTTP 429 und HTTP 5xx. NIEMALS wiederholt werden: HTTP 4xx (außer 429),
 * Validierungs-/Auth-Fehler und fachliche Ablehnungen – die würden bei jeder
 * Wiederholung identisch scheitern (oder Schaden anrichten).
 *
 * Framework-frei (duck-typing auf Axios-artige Fehler), damit Desktop und
 * Backend denselben Helfer verwenden können.
 */

export interface RetryOptions {
  /** Maximale Wiederholungen NACH dem Erstversuch (Default 3). */
  retries?: number;
  /** Basis-Wartezeit in ms (Default 1000; 1s, 2s, 4s … mit Jitter). */
  baseDelayMs?: number;
  /** Injizierbar für Tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Jitter-Quelle, injizierbar für Tests (Default Math.random). */
  random?: () => number;
  /** Hook je Wiederholung – z. B. um im UI den Zustand anzuzeigen. */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

const NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EPIPE",
  "ERR_NETWORK",
]);

/** true, wenn ein erneuter Versuch sinnvoll ist (Netzwerk/Timeout/429/5xx). */
export function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: unknown;
    isAxiosError?: unknown;
    response?: { status?: unknown } | null;
  };

  const status = typeof e.response?.status === "number" ? e.response.status : undefined;
  if (status !== undefined) {
    // 429 und 5xx sind transient; alle übrigen 4xx sind endgültig.
    return status === 429 || status >= 500;
  }
  // Keine HTTP-Antwort: Transportfehler (Timeout, DNS, Verbindungsabriss).
  if (typeof e.code === "string" && NETWORK_CODES.has(e.code)) return true;
  if (e.isAxiosError === true && !e.response) return true;
  return false;
}

/** Führt fn aus und wiederholt transiente Fehler mit Backoff + Jitter. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransientError(err)) throw err;
      // Voll-Jitter: base * 2^attempt * (0.5 … 1.5)
      const delay = Math.round(base * 2 ** attempt * (0.5 + random()));
      opts.onRetry?.(attempt + 1, delay, err);
      await sleep(delay);
    }
  }
}
