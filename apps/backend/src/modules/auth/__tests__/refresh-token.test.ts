import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import type { PrismaService } from "../../../database/prisma.service";
import type { JwtService } from "@nestjs/jwt";
import type { ConfigService } from "@nestjs/config";

/**
 * Beweis für den Session-Ablauf-Bug: Der frühere Code hashte den eingereichten
 * Refresh-Token mit argon2 (frisches Salt pro Aufruf) und suchte dann per
 * Gleichheit nach tokenHash – ein Treffer war damit PRINZIPIELL unmöglich,
 * jeder Refresh endete 401 ("Ungültiger Refresh Token"), jede Session war nach
 * Ablauf des Access-Tokens tot. Diese Tests wären mit dem alten Code rot.
 */
describe("AuthService – Refresh-Token-Rotation", () => {
  /** In-Memory refresh_tokens-Tabelle. */
  interface Row {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }
  let rows: Row[];
  let nextId: number;

  const user = {
    id: "user-1",
    tenantId: "tenant-1",
    email: "admin@demo.adept.de",
    role: "TENANT_ADMIN",
    firstName: "Max",
    lastName: "Admin",
    isActive: true,
  };

  const prismaStub = {
    refreshToken: {
      create: vi.fn(async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const row: Row = { id: `rt-${nextId++}`, revokedAt: null, ...data };
        rows.push(row);
        return row;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: { tokenHash: string; revokedAt: null; expiresAt: { gt: Date } } }) => {
          const row = rows.find(
            (r) => r.tokenHash === where.tokenHash && r.revokedAt === null && r.expiresAt > where.expiresAt.gt
          );
          return row ? { ...row, user } : null;
        }
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) row.revokedAt = data.revokedAt;
        return row;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  };

  const jwtStub = { sign: vi.fn(() => "signed-access-token") };
  const configStub = { get: vi.fn() };

  let service: AuthService;

  beforeEach(() => {
    rows = [];
    nextId = 1;
    vi.clearAllMocks();
    service = new AuthService(
      prismaStub as unknown as PrismaService,
      jwtStub as unknown as JwtService,
      configStub as unknown as ConfigService
    );
  });

  /** Erzeugt wie beim Login einen gespeicherten Refresh-Token und gibt das Klartext-Token zurück. */
  async function issueToken(): Promise<string> {
    return (service as unknown as { createRefreshToken(userId: string): Promise<string> }).createRefreshToken(
      user.id
    );
  }

  it("Zustand 'Access abgelaufen, Refresh gültig': Refresh FINDET den gespeicherten Token und liefert neue Tokens", async () => {
    const token = await issueToken();
    const result = await service.refreshTokens(token);
    expect(result.accessToken).toBe("signed-access-token");
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(token); // Rotation: neues Token
  });

  it("rotiert: der alte Token ist nach erfolgreichem Refresh revoked und wird bei Wiedereinreichung abgelehnt", async () => {
    const token = await issueToken();
    await service.refreshTokens(token);
    await expect(service.refreshTokens(token)).rejects.toThrow(UnauthorizedException);
  });

  it("Refresh-Race: NUR der eingereichte alte Token wird ungültig – der neue bleibt nutzbar (keine Familien-Invalidierung)", async () => {
    const token = await issueToken();
    const first = await service.refreshTokens(token);
    // Zweiter (verspäteter) Versuch mit dem alten Token scheitert …
    await expect(service.refreshTokens(token)).rejects.toThrow(UnauthorizedException);
    // … aber der aus dem ersten Refresh erhaltene Token funktioniert weiterhin.
    const second = await service.refreshTokens(first.refreshToken);
    expect(second.accessToken).toBe("signed-access-token");
  });

  it("Zustand 'lange offline, Token seit Tagen abgelaufen': abgelaufener Token wird abgelehnt", async () => {
    const token = await issueToken();
    rows[0]!.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await expect(service.refreshTokens(token)).rejects.toThrow(UnauthorizedException);
  });

  it("unbekannter Token wird abgelehnt", async () => {
    await expect(service.refreshTokens("voellig-unbekannt")).rejects.toThrow(UnauthorizedException);
  });
});
