import { Injectable, ConflictException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import type { CreateTenantRequestDto, CreateTenantResponse } from "@youman/shared";

const PLAN_MAP = { starter: "STARTER", professional: "PROFESSIONAL", enterprise: "ENTERPRISE" } as const;

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Legt eine neue Kunden-Firma (Tenant) mit ihrem ersten Admin-Nutzer an.
   * Jede Firma ist ab hier vollständig isoliert: eigener Login-Slug, eigene
   * Nutzer, eigene Daten – erzwungen durch tenantId auf jeder Tabelle.
   */
  async createTenant(dto: CreateTenantRequestDto): Promise<CreateTenantResponse> {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Slug '${dto.slug}' ist bereits vergeben`);
    }

    const passwordHash = await argon2.hash(dto.adminPassword);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          slug: dto.slug,
          name: dto.companyName,
          plan: PLAN_MAP[dto.plan],
          status: "ACTIVE",
          settings: {
            create: {
              defaultLocale: "de-DE",
              defaultCurrency: "EUR",
              timezone: "Europe/Berlin",
            },
          },
        },
      });

      await tx.user.create({
        data: {
          tenantId: created.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          role: "TENANT_ADMIN",
          isActive: true,
        },
      });

      return created;
    });

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      companyName: tenant.name,
      adminEmail: dto.adminEmail,
    };
  }
}
