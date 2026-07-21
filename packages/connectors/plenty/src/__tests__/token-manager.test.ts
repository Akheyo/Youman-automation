import { describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { PlentyTokenManager } from "../auth/PlentyTokenManager";
import { AuthError } from "../errors";

const silentLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

function loginResponse(token: string, refresh = `${token}-refresh`, expiresIn = 86_400) {
  return { data: { accessToken: token, refreshToken: refresh, expiresIn } };
}

function manager(post: ReturnType<typeof vi.fn>, now: () => number) {
  return new PlentyTokenManager({
    baseUrl: "https://demo.my.plentysystems.com/rest",
    username: "api-user",
    password: "secret",
    http: { post } as unknown as AxiosInstance,
    now,
    logger: silentLogger,
  });
}

describe("PlentyTokenManager", () => {
  it("performs the initial login once and reuses the token", async () => {
    const post = vi.fn().mockResolvedValue(loginResponse("tok-1"));
    const mgr = manager(post, () => 0);

    expect(await mgr.getAccessToken()).toBe("tok-1");
    expect(await mgr.getAccessToken()).toBe("tok-1");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/login", { username: "api-user", password: "secret" });
  });

  it("proactively refreshes when less than 30 minutes remain", async () => {
    let nowMs = 0;
    const post = vi
      .fn()
      .mockResolvedValueOnce(loginResponse("tok-1", "refresh-1", 3600)) // 1h lifetime
      .mockResolvedValueOnce(loginResponse("tok-2", "refresh-2", 86_400));
    const mgr = manager(post, () => nowMs);

    expect(await mgr.getAccessToken()).toBe("tok-1");

    nowMs = 35 * 60 * 1000; // 25 min lifetime left → below the 30-min window
    expect(await mgr.getAccessToken()).toBe("tok-2");
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/login/refresh",
      { refreshToken: "refresh-1" },
      expect.objectContaining({ headers: { Authorization: "Bearer refresh-1" } })
    );
  });

  it("does not refresh while plenty of lifetime remains", async () => {
    let nowMs = 0;
    const post = vi.fn().mockResolvedValue(loginResponse("tok-1", "refresh-1", 86_400));
    const mgr = manager(post, () => nowMs);

    await mgr.getAccessToken();
    nowMs = 12 * 3600 * 1000; // 12h of 24h left
    await mgr.getAccessToken();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("reactively refreshes on 401 via handleUnauthorized", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(loginResponse("tok-1", "refresh-1"))
      .mockResolvedValueOnce(loginResponse("tok-2", "refresh-2"));
    const mgr = manager(post, () => 0);

    await mgr.getAccessToken();
    expect(await mgr.handleUnauthorized()).toBe("tok-2");
    expect(post.mock.calls[1]![0]).toBe("/login/refresh");
  });

  it("falls back to a full re-login when the refresh fails", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(loginResponse("tok-1", "refresh-1"))
      .mockRejectedValueOnce(new Error("refresh expired"))
      .mockResolvedValueOnce(loginResponse("tok-3"));
    const mgr = manager(post, () => 0);

    await mgr.getAccessToken();
    expect(await mgr.handleUnauthorized()).toBe("tok-3");
    expect(post.mock.calls.map((c) => c[0])).toEqual(["/login", "/login/refresh", "/login"]);
  });

  it("throws AuthError when refresh AND re-login fail – no endless retry", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(loginResponse("tok-1", "refresh-1"))
      .mockRejectedValueOnce(new Error("refresh expired"))
      .mockRejectedValueOnce(new Error("bad credentials"));
    const mgr = manager(post, () => 0);

    await mgr.getAccessToken();
    await expect(mgr.handleUnauthorized()).rejects.toBeInstanceOf(AuthError);
    expect(post).toHaveBeenCalledTimes(3); // login + refresh + re-login, nothing more
  });

  it("throws AuthError when the initial login fails", async () => {
    const post = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const mgr = manager(post, () => 0);
    await expect(mgr.getAccessToken()).rejects.toBeInstanceOf(AuthError);
  });

  it("dedupes concurrent login attempts", async () => {
    const post = vi.fn().mockResolvedValue(loginResponse("tok-1"));
    const mgr = manager(post, () => 0);
    const [a, b] = await Promise.all([mgr.getAccessToken(), mgr.getAccessToken()]);
    expect(a).toBe("tok-1");
    expect(b).toBe("tok-1");
    expect(post).toHaveBeenCalledTimes(1);
  });
});
