/**
 * CLI for tenant onboarding. Creates a tenant with an initial admin user.
 *
 * Usage (inside the running backend container or with DATABASE_URL set):
 *   node dist/scripts/create-tenant.js <slug> <name> <admin-email> [--password=<pwd>]
 *
 * Examples:
 *   node dist/scripts/create-tenant.js kundenfirma "Kundenfirma GmbH" admin@kundenfirma.de
 *   docker compose exec backend node dist/scripts/create-tenant.js acme "Acme Corp" admin@acme.com
 *
 * If --password is omitted, a strong 16-char random password is generated and
 * printed once. The hash is stored; the plaintext is shown so it can be sent
 * to the new tenant admin.
 */
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { randomBytes } from "crypto";

function generatePassword(): string {
  // URL-safe charset, 16 chars, ~96 bits of entropy
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function parseArgs(argv: string[]): {
  slug: string;
  name: string;
  email: string;
  password?: string;
} {
  const positional: string[] = [];
  let password: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--password=")) password = arg.slice("--password=".length);
    else positional.push(arg);
  }
  const [slug, name, email] = positional;
  if (!slug || !name || !email) {
    console.error(
      "Usage: create-tenant <slug> <name> <admin-email> [--password=<pwd>]\n" +
        '  e.g. create-tenant acme "Acme GmbH" admin@acme.de',
    );
    process.exit(1);
  }
  return { slug, name, email, password };
}

async function main() {
  const { slug, name, email, password: providedPassword } = parseArgs(process.argv.slice(2));
  const password = providedPassword ?? generatePassword();

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      console.error(`Tenant '${slug}' already exists (id ${existing.id}).`);
      process.exit(2);
    }

    const passwordHash = await argon2.hash(password);

    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name,
        plan: "STARTER",
        status: "ACTIVE",
        settings: { create: {} },
        branding: { create: { appName: name } },
        users: {
          create: {
            email,
            passwordHash,
            firstName: "Admin",
            lastName: name,
            role: "TENANT_ADMIN",
            isActive: true,
          },
        },
      },
      include: { users: true },
    });

    console.log("\n────────────────────────────────────────────────────────");
    console.log("✓ Tenant created successfully");
    console.log("────────────────────────────────────────────────────────");
    console.log(`  Tenant ID  : ${tenant.id}`);
    console.log(`  Slug       : ${tenant.slug}`);
    console.log(`  Name       : ${tenant.name}`);
    console.log("");
    console.log("  Initial admin login:");
    console.log(`    Mandant   : ${tenant.slug}`);
    console.log(`    E-Mail    : ${email}`);
    console.log(`    Passwort  : ${password}${providedPassword ? "" : "  (auto-generated, store securely)"}`);
    console.log("────────────────────────────────────────────────────────\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed to create tenant:", err);
  process.exit(1);
});
