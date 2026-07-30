import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import { PlatformAdminService } from "../platform-admin.service";
import type { PrismaService } from "../../../database/prisma.service";
import type { CreateTenantRequestDto } from "@youman/shared";

/**
 * Beweis für die Mandanten-Isolation ab dem ersten Moment: Jede neue Firma
 * bekommt einen eigenen Tenant + genau einen Admin-Nutzer, ein doppelter
 * Slug wird abgelehnt (kein Überschreiben einer bestehenden Firma).
 */
describe("PlatformAdminService – Mandant anlegen", () => {
  let tenants: Array<{ id: string; slug: string; name: string; plan: string }>;
  let users: Array<{ tenantId: string; email: string; role: string; passwordHash: string }>;
  let nextId: number;
  let service: PlatformAdminService;

  const prismaStub = {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) =>
        tenants.find((t) => t.slug === where.slug) ?? null
      ),
      create: vi.fn(async ({ data }: { data: { slug: string; name: string; plan: string } }) => {
        const row = { id: `tenant-${++nextId}`, slug: data.slug, name: data.name, plan: data.plan };
        tenants.push(row);
        return row;
      }),
    },
    user: {
      create: vi.fn(async ({ data }: { data: { tenantId: string; email: string; role: string; passwordHash: string } }) => {
        users.push(data);
        return { id: `user-${nextId}`, ...data };
      }),
    },
    $transaction: vi.fn(),
  };
  prismaStub.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaStub));

  const dto: CreateTenantRequestDto = {
    companyName: "Bergmann Handels GmbH",
    slug: "bergmann",
    plan: "starter",
    adminEmail: "admin@bergmann-handel.de",
    adminFirstName: "Max",
    adminLastName: "Bergmann",
    adminPassword: "SicheresPasswort123",
  };

  beforeEach(() => {
    tenants = [];
    users = [];
    nextId = 0;
    service = new PlatformAdminService(prismaStub as unknown as PrismaService);
  });

  it("legt einen neuen Mandanten mit erstem Admin-Nutzer an", async () => {
    const result = await service.createTenant(dto);

    expect(result.slug).toBe("bergmann");
    expect(result.companyName).toBe("Bergmann Handels GmbH");
    expect(tenants).toHaveLength(1);
    expect(users).toHaveLength(1);
    expect(users[0]!.tenantId).toBe(tenants[0]!.id);
    expect(users[0]!.role).toBe("TENANT_ADMIN");
  });

  it("speichert das Passwort niemals im Klartext", async () => {
    await service.createTenant(dto);
    expect(users[0]!.passwordHash).not.toBe(dto.adminPassword);
    expect(users[0]!.passwordHash.length).toBeGreaterThan(20);
  });

  it("lehnt einen bereits vergebenen Slug ab, statt die Firma zu überschreiben", async () => {
    await service.createTenant(dto);
    await expect(service.createTenant(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tenants).toHaveLength(1); // kein zweiter Tenant, keine Überschreibung
  });

  it("isoliert zwei verschiedene Firmen mit eigenem Admin", async () => {
    await service.createTenant(dto);
    await service.createTenant({ ...dto, slug: "amikon", companyName: "Amikon GmbH", adminEmail: "admin@amikon.de" });

    expect(tenants).toHaveLength(2);
    expect(users).toHaveLength(2);
    expect(tenants[0]!.id).not.toBe(tenants[1]!.id);
    expect(users[0]!.tenantId).not.toBe(users[1]!.tenantId);
  });
});
