import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { API_CONTRACT_VERSION } from "@youman/shared";
import { PrismaService } from "../../database/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";

/** Backend-Version aus package.json (einmalig, best-effort). */
const BACKEND_VERSION: string = (() => {
  for (const p of [resolve(process.cwd(), "package.json"), resolve(__dirname, "../../../../package.json")]) {
    try {
      const pkg = JSON.parse(readFileSync(p, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "@youman/backend" && pkg.version) return pkg.version;
    } catch {
      // nächsten Kandidaten probieren
    }
  }
  return "unbekannt";
})();

interface ProbeResult {
  healthy: boolean;
  latencyMs?: number;
  /** Kurzbeschreibung ohne technische Interna (keine URLs, keine Rohfehler). */
  message?: string;
}

const DB_PROBE_TIMEOUT_MS = 5_000;
const ERP_PROBE_TIMEOUT_MS = 10_000;

/**
 * Unauthentifizierter Health-Check für Betrieb/Monitoring (Render, Uptime-
 * Robot, Desktop-Kaltstart-Erkennung). Prüft die Datenbank immer, das ERP
 * nur auf Anfrage (?tenant=<slug>), weil dafür eine Mandanten-Konfiguration
 * nötig ist. Gibt bewusst nur healthy/latency/Kurztext zurück – niemals
 * Verbindungsdetails oder Fehlerinterna.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService
  ) {}

  @Get()
  async check(@Query("tenant") tenantSlug?: string) {
    const db = await this.probeDb();
    const erp = tenantSlug ? await this.probeErp(tenantSlug) : undefined;

    const healthy = db.healthy && (erp?.healthy ?? true);
    return {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: BACKEND_VERSION,
      // Kontrakt-Check: Die Desktop-App vergleicht diesen Wert mit ihrer
      // eigenen API_CONTRACT_VERSION und warnt bei Abweichung.
      apiContract: API_CONTRACT_VERSION,
      db,
      ...(erp ? { erp } : {}),
    };
  }

  private async probeDb(): Promise<ProbeResult> {
    const start = Date.now();
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, DB_PROBE_TIMEOUT_MS);
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: "Datenbank nicht erreichbar",
      };
    }
  }

  private async probeErp(tenantSlug: string): Promise<ProbeResult> {
    const start = Date.now();
    try {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) return { healthy: false, message: "Mandant unbekannt" };
      const connector = await withTimeout(this.connectors.getConnector(tenant.id), ERP_PROBE_TIMEOUT_MS);
      const result = await withTimeout(connector.healthCheck(), ERP_PROBE_TIMEOUT_MS);
      return {
        healthy: result.healthy,
        latencyMs: Date.now() - start,
        // healthCheck-Message kann ERP-Fehlertext enthalten – nicht spiegeln.
        ...(result.healthy ? {} : { message: "ERP-System nicht erreichbar" }),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: "ERP-Prüfung fehlgeschlagen",
      };
    }
  }
}

function withTimeout<T>(p: Promise<T> | T, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error(`Timeout nach ${ms} ms`)), ms);
      // Timer darf einen Prozess-Shutdown nicht blockieren.
      (t as { unref?: () => void }).unref?.();
    }),
  ]);
}
