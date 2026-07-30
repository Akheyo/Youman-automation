import { describe, expect, it } from "vitest";
import { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { PlatformAdminGuard } from "../../../common/guards/platform-admin.guard";

/**
 * Beweis für "fail-closed": Ohne PLATFORM_ADMIN_KEY ist der
 * Mandanten-Anlegen-Endpunkt für NIEMANDEN erreichbar – kein versehentlich
 * offener Cross-Tenant-Endpunkt in Produktion, wenn das Secret fehlt.
 */
describe("PlatformAdminGuard", () => {
  const makeContext = (headerValue?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: headerValue !== undefined ? { "x-platform-admin-key": headerValue } : {} }),
      }),
    }) as unknown as ExecutionContext;

  it("lehnt jede Anfrage ab, wenn kein Schlüssel konfiguriert ist", () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const guard = new PlatformAdminGuard(config);
    expect(() => guard.canActivate(makeContext("irgendwas"))).toThrow();
  });

  it("lehnt einen falschen Schlüssel ab", () => {
    const config = { get: () => "correct-secret" } as unknown as ConfigService;
    const guard = new PlatformAdminGuard(config);
    expect(() => guard.canActivate(makeContext("wrong-secret"))).toThrow();
  });

  it("lehnt eine Anfrage ganz ohne Header ab", () => {
    const config = { get: () => "correct-secret" } as unknown as ConfigService;
    const guard = new PlatformAdminGuard(config);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow();
  });

  it("lässt den korrekten Schlüssel durch", () => {
    const config = { get: () => "correct-secret" } as unknown as ConfigService;
    const guard = new PlatformAdminGuard(config);
    expect(guard.canActivate(makeContext("correct-secret"))).toBe(true);
  });
});
