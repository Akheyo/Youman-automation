import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaService } from "../../database/prisma.service";

/**
 * Synchronisiert die Action-Configs (configs/actions/*.json) bei JEDEM
 * Backend-Start per Upsert in die Datenbank.
 *
 * Hintergrund: Bisher kamen Config-Änderungen nur über prisma/seed.ts in die
 * DB – im Container lief der aber best-effort über ts-node und konnte still
 * fehlschlagen ("Seed übersprungen"), wodurch Formular-Änderungen nie beim
 * Nutzer ankamen. Dieser Sync läuft im kompilierten Backend selbst und loggt
 * die aktiven Felder, damit im Deployment sichtbar ist, welche Config gilt.
 */
@Injectable()
export class ConfigSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConfigSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.sync();
    } catch (err) {
      // Ein fehlgeschlagener Sync darf den Serverstart nicht verhindern.
      this.logger.error(`Action-Config-Sync fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Kandidaten für den configs/actions-Ordner (Docker: /app, lokal: Repo-Root). */
  private findConfigsDir(): string | null {
    const candidates = [
      process.env["CONFIGS_DIR"],
      resolve(process.cwd(), "../../configs/actions"),
      resolve(process.cwd(), "configs/actions"),
      resolve(__dirname, "../../../../../configs/actions"), // aus src/
      resolve(__dirname, "../../../../../../configs/actions"), // aus dist/src/
    ].filter((p): p is string => !!p);
    return candidates.find((p) => existsSync(p)) ?? null;
  }

  async sync(): Promise<void> {
    const dir = this.findConfigsDir();
    if (!dir) {
      this.logger.warn("configs/actions nicht gefunden – Action-Configs wurden NICHT synchronisiert");
      return;
    }

    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const config = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as Record<string, unknown> & {
        id: string;
        fields?: Array<{ key: string }>;
      };
      const category = String(config["category"] ?? "sales").toUpperCase();
      const offlineBehavior = String(config["offlineBehavior"] ?? "queue").toUpperCase();

      await this.prisma.actionDefinition.upsert({
        where: { id: config.id },
        create: {
          id: config.id,
          name: String(config["name"] ?? config.id),
          displayName: String(config["displayName"] ?? config.id),
          description: String(config["description"] ?? ""),
          icon: String(config["icon"] ?? "Zap"),
          category: category as "SALES" | "PURCHASING" | "INVENTORY" | "CRM" | "ADMINISTRATION" | "LOGISTICS",
          targetSystem: String(config["targetSystem"] ?? "MOCK"),
          version: String(config["version"] ?? "1.0.0"),
          enabled: Boolean(config["enabled"] ?? true),
          allowedRoles: (config["allowedRoles"] ?? []) as never,
          configJson: config as never,
          sortOrder: Number(config["sortOrder"] ?? 0),
          offlineBehavior: offlineBehavior as "QUEUE" | "REJECT" | "LOCAL_ONLY",
          tags: (config["tags"] ?? []) as string[],
          tenantId: null,
        },
        update: {
          displayName: String(config["displayName"] ?? config.id),
          description: String(config["description"] ?? ""),
          configJson: config as never,
          enabled: Boolean(config["enabled"] ?? true),
          allowedRoles: (config["allowedRoles"] ?? []) as never,
          sortOrder: Number(config["sortOrder"] ?? 0),
        },
      });

      // Beleg im Log, welche Felder jetzt aktiv sind.
      const fieldKeys = (config.fields ?? []).map((f) => f.key).join(", ");
      this.logger.log(`Action-Config aktiv: ${config.id} – Felder: [${fieldKeys}]`);
    }
    this.logger.log(`Action-Config-Sync abgeschlossen (${files.length} Dateien aus ${dir})`);
  }
}
