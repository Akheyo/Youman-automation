import { describe, expect, it } from "vitest";
import type { ArgumentsHost } from "@nestjs/common";
import { GlobalExceptionFilter } from "../filters/global-exception.filter";

/** Minimaler ArgumentsHost-Mock mit aufzeichnendem Response. */
function makeHost(correlationId?: string) {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  let jsonBody: unknown;
  const res = {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    status: (s: number) => { statusCode = s; return res; },
    json: (b: unknown) => { jsonBody = b; },
  };
  const req = { method: "POST", url: "/api/v1/actions/execute", correlationId };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, headers, status: () => statusCode, body: () => jsonBody as Record<string, unknown> };
}

describe("GlobalExceptionFilter", () => {
  it("renders the unified shape { error: { code, message, correlationId } }", () => {
    const { host, status, body } = makeHost("cid-123");
    new GlobalExceptionFilter().catch(new Error("kaputt"), host);
    expect(status()).toBe(500);
    const b = body();
    expect(b["success"]).toBe(false);
    const error = b["error"] as Record<string, unknown>;
    expect(error["code"]).toBe("INTERNAL_ERROR");
    expect(error["correlationId"]).toBe("cid-123");
    expect(String(error["message"])).toContain("cid-123");
    expect(b["requestId"]).toBe("cid-123");
  });

  it("never leaks stacktraces, SQL, paths or credentials in the response body", () => {
    const { host, body } = makeHost("cid-leak");
    const nasty = new Error('PrismaClientKnownRequestError: SELECT "passwordHash" FROM users at /app/node_modules/@prisma/client/index.js:123');
    nasty.stack = "Error: boom\n    at Object.<anonymous> (/app/apps/backend/src/secret.ts:1:1)";
    new GlobalExceptionFilter().catch(nasty, host);
    const serialized = JSON.stringify(body());
    for (const forbidden of ["Prisma", "SELECT", "passwordHash", "node_modules", "secret.ts", "at Object"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("sets Retry-After for rate-limit errors", () => {
    const { host, headers, status } = makeHost("cid-rl");
    const err = Object.assign(new Error("limit"), { code: "PLENTY_RATE_LIMIT", retryAfterSeconds: 30 });
    new GlobalExceptionFilter().catch(err, host);
    expect(status()).toBe(429);
    expect(headers["Retry-After"]).toBe("30");
  });

  it("generates a correlationId when the middleware did not run", () => {
    const { host, body } = makeHost(undefined);
    new GlobalExceptionFilter().catch(new Error("x"), host);
    const error = (body()["error"]) as Record<string, unknown>;
    expect(typeof error["correlationId"]).toBe("string");
    expect(String(error["correlationId"]).length).toBeGreaterThan(10);
  });
});
