import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, string> = {
  sales: "SALES",
  purchasing: "PURCHASING",
  inventory: "INVENTORY",
  crm: "CRM",
  administration: "ADMINISTRATION",
  logistics: "LOGISTICS",
};

const OFFLINE_MAP: Record<string, string> = {
  queue: "QUEUE",
  reject: "REJECT",
  local_only: "LOCAL_ONLY",
};

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
          primaryColor: "#3d3835",
          secondaryColor: "#6b5e57",
          accentColor: "#10B981",
          appName: "adept& Demo",
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

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);

  // Admin user
  const adminHash = await argon2.hash("Admin123!");
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@demo.adept.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@demo.adept.de",
      passwordHash: adminHash,
      firstName: "Max",
      lastName: "Admin",
      role: "TENANT_ADMIN",
    },
  });

  // Sales user
  const salesHash = await argon2.hash("Sales123!");
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "sales@demo.adept.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "sales@demo.adept.de",
      passwordHash: salesHash,
      firstName: "Anna",
      lastName: "Vertrieb",
      role: "SALES",
    },
  });

  console.log(`Users seeded for tenant ${tenant.slug}`);
  console.log(`  admin@demo.adept.de / Admin123!`);
  console.log(`  sales@demo.adept.de / Sales123!`);

  // Action Definitions – load from configs/actions/*.json
  const configsDir = path.resolve(__dirname, "../../../configs/actions");
  if (fs.existsSync(configsDir)) {
    const files = fs.readdirSync(configsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const config = JSON.parse(fs.readFileSync(path.join(configsDir, file), "utf8"));
      const category = CATEGORY_MAP[config.category as string] ?? "SALES";
      const offlineBehavior = OFFLINE_MAP[(config.offlineBehavior as string)?.toLowerCase()] ?? "QUEUE";

      await prisma.actionDefinition.upsert({
        where: { id: config.id },
        create: {
          id: config.id,
          name: config.name,
          displayName: config.displayName,
          description: config.description ?? "",
          icon: config.icon ?? "Zap",
          category: category as "SALES" | "PURCHASING" | "INVENTORY" | "CRM" | "ADMINISTRATION" | "LOGISTICS",
          targetSystem: config.targetSystem ?? "MOCK",
          version: config.version ?? "1.0.0",
          enabled: config.enabled ?? true,
          allowedRoles: config.allowedRoles ?? [],
          configJson: config,
          sortOrder: config.sortOrder ?? 0,
          offlineBehavior: offlineBehavior as "QUEUE" | "REJECT" | "LOCAL_ONLY",
          tags: config.tags ?? [],
          tenantId: null,
        },
        update: {
          displayName: config.displayName,
          description: config.description ?? "",
          configJson: config,
          enabled: config.enabled ?? true,
          allowedRoles: config.allowedRoles ?? [],
          sortOrder: config.sortOrder ?? 0,
        },
      });
      console.log(`  Action: ${config.id}`);
    }
  } else {
    console.warn(`  No configs dir found at ${configsDir}`);
  }

  console.log("Seeding complete.");
  void admin;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
