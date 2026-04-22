import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    return this.prisma.tenantBranding.findUnique({ where: { tenantId } });
  }

  async update(tenantId: string, data: Record<string, unknown>) {
    return this.prisma.tenantBranding.update({ where: { tenantId }, data });
  }
}
