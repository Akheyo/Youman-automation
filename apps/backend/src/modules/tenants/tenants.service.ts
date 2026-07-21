import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService,
  ) {}

  async findBySlug(slug: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { settings: true, branding: true, connectorConfig: true },
    });
    if (!t) throw new NotFoundException("Mandant nicht gefunden");
    return t;
  }

  async getSettings(tenantId: string) {
    return this.prisma.tenantSettings.findUnique({ where: { tenantId } });
  }

  async updateSettings(tenantId: string, data: Record<string, unknown>) {
    return this.prisma.tenantSettings.update({ where: { tenantId }, data });
  }

  async getConnectorConfig(tenantId: string) {
    const config = await this.prisma.connectorConfig.findUnique({ where: { tenantId } });
    if (config?.connectorType === "PLENTY" && config.config && typeof config.config === "object") {
      // Plenty credentials must never reach the Electron client; the admin UI
      // keeps the stored password by submitting an empty field.
      const { password: _password, ...rest } = config.config as Record<string, unknown>;
      return { ...config, config: { ...rest, password: "" } };
    }
    return config;
  }

  async updateConnectorConfig(tenantId: string, data: {
    connectorType?: string;
    displayName?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }) {
    // Empty PLENTY password means "keep the stored one" – the GET endpoint
    // redacts it, so the admin form round-trips an empty string.
    if (data.connectorType === "PLENTY" && data.config && !data.config["password"]) {
      const existing = await this.prisma.connectorConfig.findUnique({ where: { tenantId } });
      const storedPassword =
        existing?.connectorType === "PLENTY" && existing.config && typeof existing.config === "object"
          ? (existing.config as Record<string, unknown>)["password"]
          : undefined;
      if (storedPassword) {
        data.config = { ...data.config, password: storedPassword };
      }
    }

    const updated = await this.prisma.connectorConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        connectorType: (data.connectorType ?? "MOCK") as import("@prisma/client").ConnectorType,
        displayName: data.displayName ?? "ERP Connector",
        enabled: data.enabled ?? true,
        config: (data.config ?? {}) as import("@prisma/client").Prisma.InputJsonValue,
      },
      update: {
        connectorType: data.connectorType as import("@prisma/client").ConnectorType | undefined,
        displayName: data.displayName,
        enabled: data.enabled,
        config: data.config as import("@prisma/client").Prisma.InputJsonValue | undefined,
      },
    });

    this.connectors.invalidateCache(tenantId);
    return updated;
  }

  async testConnectorConfig(tenantId: string) {
    const connector = await this.connectors.getConnector(tenantId);
    return connector.healthCheck();
  }
}
