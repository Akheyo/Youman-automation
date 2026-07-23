import { describe, expect, it, vi } from "vitest";
import { withRetry, isTransientError } from "@youman/shared";

/** Axios-artiger Fehler mit HTTP-Status. */
const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status } });
/** Transportfehler ohne Antwort. */
const netError = (code: string) =>
  Object.assign(new Error(code), { isAxiosError: true, code, response: undefined });

const instant = { sleep: vi.fn(async () => undefined), random: () => 0.5 };

describe("isTransientError – Retry-Matrix", () => {
  it("wiederholbar: Netzwerk, Timeout, 429, 5xx", () => {
    expect(isTransientError(netError("ECONNRESET"))).toBe(true);
    expect(isTransientError(netError("ETIMEDOUT"))).toBe(true);
    expect(isTransientError(netError("ECONNABORTED"))).toBe(true);
    expect(isTransientError(httpError(429))).toBe(true);
    expect(isTransientError(httpError(500))).toBe(true);
    expect(isTransientError(httpError(503))).toBe(true);
  });

  it("NIEMALS wiederholbar: 4xx außer 429, Validierung, Auth, fachliche Ablehnung", () => {
    expect(isTransientError(httpError(400))).toBe(false);
    expect(isTransientError(httpError(401))).toBe(false);
    expect(isTransientError(httpError(403))).toBe(false);
    expect(isTransientError(httpError(404))).toBe(false);
    expect(isTransientError(httpError(409))).toBe(false);
    expect(isTransientError(httpError(422))).toBe(false);
    expect(isTransientError(new Error("Validierung fehlgeschlagen"))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe("withRetry", () => {
  it("wiederholt transiente Fehler mit exponentiellem Backoff und liefert dann das Ergebnis", async () => {
    const sleep = vi.fn(async (_ms: number) => undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(netError("ECONNRESET"))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, { sleep, random: () => 0.5 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    // deterministischer Jitter (0.5 -> Faktor 1.0): 1000, 2000
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it("gibt nach erschöpften Versuchen den letzten Fehler weiter", async () => {
    const fn = vi.fn().mockRejectedValue(httpError(500));
    await expect(withRetry(fn, { ...instant, retries: 3 })).rejects.toThrow("HTTP 500");
    expect(fn).toHaveBeenCalledTimes(4); // Erstversuch + 3 Retries
  });

  it("wiederholt endgültige Fehler (422) NICHT", async () => {
    const fn = vi.fn().mockRejectedValue(httpError(422));
    await expect(withRetry(fn, instant)).rejects.toThrow("HTTP 422");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("meldet jede Wiederholung über onRetry (UI-Zustand)", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce("ok");
    await withRetry(fn, { ...instant, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]![0]).toBe(1); // attempt
  });
});
