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
    return this.prisma.connectorConfig.findUnique({ where: { tenantId } });
  }

  async updateConnectorConfig(tenantId: string, data: {
    connectorType?: string;
    displayName?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }) {
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
