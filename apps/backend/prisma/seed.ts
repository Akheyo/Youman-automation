import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Demo Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Demo GmbH",
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      settings: {
        create: {
          defaultLocale: "de-DE",
          defaultCurrency: "EUR",
          timezone: "Europe/Berlin",
        },
      },
      branding: {
        create: {
          primaryColor: "#2563EB",
          secondaryColor: "#1E40AF",
          accentColor: "#10B981",
          appName: "Youman Demo",
        },
      },
      connectorConfig: {
        create: {
          connectorType: "MOCK",
          displayName: "Mock SAP (Demo)",
          enabled: true,
          config: {},
        },
      },
    },
  });

  console.log(`Tenant created: ${tenant.slug} (${tenant.id})`);

  // Admin user
  const adminHash = await argon2.hash("Admin123!");
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@demo.youman.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@demo.youman.de",
      passwordHash: adminHash,
      firstName: "Max",
      lastName: "Admin",
      role: "TENANT_ADMIN",
    },
  });

  // Sales user
  const salesHash = await argon2.hash("Sales123!");
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "sales@demo.youman.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "sales@demo.youman.de",
      passwordHash: salesHash,
      firstName: "Anna",
      lastName: "Vertrieb",
      role: "SALES",
    },
  });

  console.log(`Users seeded for tenant ${tenant.slug}`);
  console.log(`  admin@demo.youman.de / Admin123!`);
  console.log(`  sales@demo.youman.de / Sales123!`);
  console.log("Seeding complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
