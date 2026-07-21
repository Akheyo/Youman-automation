import { describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { PlentyHttpClient } from "../http/PlentyHttpClient";
import type { PlentyTokenManager } from "../auth/PlentyTokenManager";
import { AuthError, NotFoundError, RateLimitError, ValidationError } from "../errors";
import { validationErrorBody } from "./fixtures";

const silentLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

function axiosError(status: number, data: unknown = {}, headers: Record<string, string> = {}) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data, headers, statusText: "", config: {} },
  });
}

interface Harness {
  client: PlentyHttpClient;
  request: ReturnType<typeof vi.fn>;
  sleep: ReturnType<typeof vi.fn>;
  tokens: { getAccessToken: ReturnType<typeof vi.fn>; handleUnauthorized: ReturnType<typeof vi.fn> };
}

function harness(): Harness {
  const request = vi.fn();
  const sleep = vi.fn().mockResolvedValue(undefined);
  const tokens = {
    getAccessToken: vi.fn().mockResolvedValue("tok-1"),
    handleUnauthorized: vi.fn().mockResolvedValue("tok-2"),
  };
  let nowMs = 0;
  sleep.mockImplementation(async (ms: number) => {
    nowMs += ms; // advance the fake clock so throttling windows expire
  });
  const client = new PlentyHttpClient({
    baseUrl: "https://demo.my.plentysystems.com/rest",
    tokenManager: tokens as unknown as PlentyTokenManager,
    http: { request } as unknown as AxiosInstance,
    logger: silentLogger,
    sleep,
    random: () => 0.5, // deterministic jitter: factor exactly 1.0
    now: () => nowMs,
  });
  return { client, request, sleep, tokens };
}

const ok = (data: unknown, headers: Record<string, string> = {}) => ({ data, headers });

describe("PlentyHttpClient – 429 backoff", () => {
  it("retries with exponential backoff and jitter, then succeeds", async () => {
    const { client, request, sleep } = harness();
    request
      .mockRejectedValueOnce(axiosError(429))
      .mockRejectedValueOnce(axiosError(429))
      .mockResolvedValueOnce(ok({ fine: true }));

    await expect(client.get("/orders")).resolves.toEqual({ fine: true });
    // deterministic jitter → 1000ms, 2000ms
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it("throws RateLimitError after 3 failed retries", async () => {
    const { client, request, sleep } = harness();
    request.mockRejectedValue(axiosError(429, {}, { "x-plenty-global-short-period-decay": "17" }));

    const err = await client.get("/orders").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSeconds).toBe(17);
    expect(request).toHaveBeenCalledTimes(4); // initial + 3 retries
    expect(sleep).toHaveBeenCalledTimes(3);
  });
});

describe("PlentyHttpClient – header-based throttling", () => {
  it("throttles the next request when calls-left drops below 10% of the limit", async () => {
    const { client, request, sleep } = harness();
    request
      .mockResolvedValueOnce(
        ok({ page: 1 }, {
          "x-plenty-global-long-period-limit": "5000",
          "x-plenty-global-long-period-calls-left": "400", // 8% < 10%
          "x-plenty-global-long-period-decay": "42",
        })
      )
      .mockResolvedValueOnce(ok({ page: 2 }));

    await client.get("/accounts/contacts");
    expect(sleep).not.toHaveBeenCalled();

    await client.get("/accounts/contacts");
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]![0]).toBe(42_000);
  });

  it("does not throttle while enough calls are left", async () => {
    const { client, request, sleep } = harness();
    request.mockResolvedValue(
      ok({}, {
        "x-plenty-global-long-period-limit": "5000",
        "x-plenty-global-long-period-calls-left": "4900",
        "x-plenty-global-long-period-decay": "42",
      })
    );

    await client.get("/a");
    await client.get("/b");
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("PlentyHttpClient – 5xx retries", () => {
  it("retries up to 2 times on 5xx and then succeeds", async () => {
    const { client, request } = harness();
    request
      .mockRejectedValueOnce(axiosError(502))
      .mockRejectedValueOnce(axiosError(503))
      .mockResolvedValueOnce(ok({ up: true }));

    await expect(client.get("/health")).resolves.toEqual({ up: true });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("gives up after 2 retries on persistent 5xx", async () => {
    const { client, request } = harness();
    request.mockRejectedValue(axiosError(500));

    await expect(client.get("/health")).rejects.toThrow(/HTTP 500/);
    expect(request).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe("PlentyHttpClient – auth handling", () => {
  it("re-authenticates exactly once on 401 and retries the request", async () => {
    const { client, request, tokens } = harness();
    request.mockRejectedValueOnce(axiosError(401)).mockResolvedValueOnce(ok({ authed: true }));

    await expect(client.get("/accounts/contacts")).resolves.toEqual({ authed: true });
    expect(tokens.handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("throws AuthError when the API keeps responding 401 after re-auth", async () => {
    const { client, request, tokens } = harness();
    request.mockRejectedValue(axiosError(401));

    await expect(client.get("/accounts/contacts")).rejects.toBeInstanceOf(AuthError);
    expect(tokens.handleUnauthorized).toHaveBeenCalledTimes(1); // no endless auth loop
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("PlentyHttpClient – error mapping", () => {
  it("maps 404 to NotFoundError", async () => {
    const { client, request } = harness();
    request.mockRejectedValue(axiosError(404));
    await expect(client.get("/accounts/contacts/999")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps 422 with field-keyed body to a readable ValidationError", async () => {
    const { client, request } = harness();
    request.mockRejectedValue(axiosError(422, validationErrorBody));

    const err = await client.post("/orders", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toContain("plentyId");
  });

  it("sends the bearer token with every request", async () => {
    const { client, request } = harness();
    request.mockResolvedValue(ok({}));
    await client.get("/accounts/contacts");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: "Bearer tok-1" } })
    );
  });
});
