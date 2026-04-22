import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
