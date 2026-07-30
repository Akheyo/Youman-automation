import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";

/** Deterministischer Hash für Refresh-Token-Lookups (Token = 256-bit-Zufall). */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
import { PrismaService } from "../../database/prisma.service";
import { QUOTE_TEXT_DEFAULTS } from "@youman/shared";
import type { LoginRequest, LoginResponse, AuthTokenPayload, UserRole } from "@youman/shared";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(req: LoginRequest, ip?: string): Promise<LoginResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: req.tenantSlug },
      include: { settings: true, branding: true, connectorConfig: true },
    });

    if (!tenant) {
      throw new NotFoundException("Unbekannter Mandant");
    }

    if (tenant.status === "SUSPENDED") {
      throw new ForbiddenException("Dieser Mandant wurde gesperrt");
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: req.email } },
    });

    const isValid = user && (await this.verifyPassword(user.passwordHash, req.password));

    if (!user || !isValid) {
      await this.auditFailedLogin(tenant.id, req.email, ip);
      throw new UnauthorizedException("Ungültige E-Mail oder Passwort");
    }

    if (!user.isActive) {
      throw new ForbiddenException("Benutzer ist deaktiviert");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: Omit<AuthTokenPayload, "iat" | "exp"> = {
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      role: user.role as UserRole,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    this.logger.log(`Login: ${user.email} @ ${tenant.slug}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan.toLowerCase() as "starter" | "professional" | "enterprise",
        status: tenant.status.toLowerCase() as "active" | "suspended" | "trial" | "cancelled",
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        settings: tenant.settings
          ? {
              tenantId: tenant.id,
              defaultLocale: tenant.settings.defaultLocale,
              defaultCurrency: tenant.settings.defaultCurrency,
              timezone: tenant.settings.timezone,
              dateFormat: tenant.settings.dateFormat,
              enableOfflineMode: tenant.settings.enableOfflineMode,
              sessionTimeoutMinutes: tenant.settings.sessionTimeoutMinutes,
              maxRetryAttempts: tenant.settings.maxRetryAttempts,
              retryBackoffMs: tenant.settings.retryBackoffMs,
              quoteNumberNext: tenant.settings.quoteNumberNext,
              quoteNumberStep: tenant.settings.quoteNumberStep,
              quoteSalutation: tenant.settings.quoteSalutation,
              quoteDeliveryDate: tenant.settings.quoteDeliveryDate,
              quotePaymentMethod: tenant.settings.quotePaymentMethod,
              quotePaymentTerms: tenant.settings.quotePaymentTerms,
              quoteShippingMethod: tenant.settings.quoteShippingMethod,
            }
          : {
              tenantId: tenant.id,
              defaultLocale: "de-DE",
              defaultCurrency: "EUR",
              timezone: "Europe/Berlin",
              dateFormat: "DD.MM.YYYY",
              enableOfflineMode: true,
              sessionTimeoutMinutes: 480,
              quoteNumberNext: 1000,
              quoteNumberStep: 1,
              ...QUOTE_TEXT_DEFAULTS,
              maxRetryAttempts: 3,
              retryBackoffMs: 2000,
            },
        branding: tenant.branding
          ? {
              tenantId: tenant.id,
              primaryColor: tenant.branding.primaryColor,
              secondaryColor: tenant.branding.secondaryColor,
              accentColor: tenant.branding.accentColor,
              logoUrl: tenant.branding.logoUrl,
              appName: tenant.branding.appName,
              favicon: tenant.branding.favicon,
              customCss: tenant.branding.customCss,
            }
          : {
              tenantId: tenant.id,
              primaryColor: "#2563EB",
              secondaryColor: "#1E40AF",
              accentColor: "#10B981",
              logoUrl: null,
              appName: "adept&",
              favicon: null,
              customCss: null,
            },
        connectorConfig: tenant.connectorConfig
          ? {
              id: tenant.connectorConfig.id,
              tenantId: tenant.id,
              connectorType: tenant.connectorConfig.connectorType as import("@youman/shared").ConnectorType,
              displayName: tenant.connectorConfig.displayName,
              enabled: tenant.connectorConfig.enabled,
              config: tenant.connectorConfig.config as Record<string, unknown>,
              createdAt: tenant.connectorConfig.createdAt.toISOString(),
              updatedAt: tenant.connectorConfig.updatedAt.toISOString(),
            }
          : null,
      },
    };
  }

  async refreshTokens(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    // WICHTIG: Deterministischer SHA-256-Hash als Lookup-Schlüssel.
    // Der frühere Code hashte den eingereichten Token mit argon2 – das salzt
    // bei JEDEM Aufruf neu, der Lookup nach tokenHash konnte also NIEMALS den
    // beim Login gespeicherten Hash treffen: jeder Refresh endete 401, jede
    // Session war nach Ablauf des Access-Tokens unrettbar. SHA-256 ohne Salt
    // ist hier korrekt und sicher: Der Token ist ein hochentropisches
    // 256-bit-Zufallsgeheimnis (kein erratbares Passwort, Salting unnötig).
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: sha256(token), revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException("Ungültiger Refresh Token");
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = record.user;
    const payload: Omit<AuthTokenPayload, "iat" | "exp"> = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role as UserRole,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = uuid() + uuid();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt },
    });

    return token;
  }

  private async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  private async auditFailedLogin(tenantId: string, email: string, ip?: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userEmail: email,
        eventType: "USER_LOGIN_FAILED",
        description: `Fehlgeschlagener Login-Versuch für ${email}`,
        ipAddress: ip,
        severity: "WARNING",
        metadata: {},
      },
    });
  }
}
