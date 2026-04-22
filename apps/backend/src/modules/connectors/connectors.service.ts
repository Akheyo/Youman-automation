import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ConnectorFactory, type IErpConnector } from "@youman/connector-sap";
import type { ConnectorConfig } from "@youman/shared";

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);
  private readonly cache = new Map<string, IErpConnector>();

  constructor(private readonly prisma: PrismaService) {}

  async getConnector(tenantId: string): Promise<IErpConnector> {
    if (this.cache.has(tenantId)) {
      return this.cache.get(tenantId)!;
    }

    const config = await this.prisma.connectorConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      this.logger.warn(`No connector config for tenant ${tenantId}, using MOCK`);
      const mock = ConnectorFactory.create({
        id: "mock",
        tenantId,
        connectorType: "MOCK",
        displayName: "Mock",
        enabled: true,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.cache.set(tenantId, mock);
      return mock;
    }

    const connector = ConnectorFactory.create({
      id: config.id,
      tenantId,
      connectorType: config.connectorType as ConnectorConfig["connectorType"],
      displayName: config.displayName,
      enabled: config.enabled,
      config: config.config as Record<string, unknown>,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    });

    this.cache.set(tenantId, connector);
    return connector;
  }

  invalidateCache(tenantId: string): void {
    this.cache.delete(tenantId);
  }
}
