import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as argon2 from "argon2";
import { PrismaService } from "./prisma.service";

/**
 * Legt den Demo-Mandanten samt Login-Nutzern bei JEDEM Backend-Start per
 * idempotentem Upsert an.
 *
 * Hintergrund (Post-Mortem-Punkt 1): Der frühere Weg lief als
 * `ts-node prisma/seed.ts || echo 'Seed übersprungen'` im Container-CMD –
 * ein Fehlschlag war UNSICHTBAR und die Folge war ein Server, an dem sich
 * niemand anmelden konnte (Login 401, obwohl "alles deployt" war). Dieser
 * Service läuft im kompilierten Backend selbst: Erfolg wie Fehlschlag stehen
 * unübersehbar im Deploy-Log, inklusive der einsatzbereiten Zugangsdaten.
 *
 * Abschaltbar per DISABLE_DEMO_SEED=true (z. B. für echte Produktions-
 * Mandanten ohne Demo-Zugang).
 */
@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env["DISABLE_DEMO_SEED"] === "true") {
      this.logger.log("Demo-Seed deaktiviert (DISABLE_DEMO_SEED=true)");
      return;
    }
    try {
      await this.seed();
    } catch (err) {
      // Der Serverstart darf nicht scheitern – aber der Fehlschlag ist ab
      // jetzt LAUT: Diese Zeile ist im Render-Log nicht zu übersehen.
      this.logger.error(
        `DEMO-SEED FEHLGESCHLAGEN – der Demo-Login (admin@demo.adept.de) funktioniert damit NICHT: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  async seed(): Promise<void> {
    const tenant = await this.prisma.tenant.upsert({
      where: { slug: "demo" },
      update: {},
      create: {
        slug: "demo",
        name: "Demo GmbH",
        plan: "PROFESSIONAL",
        status: "ACTIVE",
        settings: {
          create: { defaultLocale: "de-DE", defaultCurrency: "EUR", timezone: "Europe/Berlin" },
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
          create: { connectorType: "MOCK", displayName: "Mock SAP (Demo)", enabled: true, config: {} },
        },
      },
    });

    await this.ensureUser(tenant.id, "admin@demo.adept.de", "Admin123!", "Max", "Admin", "TENANT_ADMIN");
    await this.ensureUser(tenant.id, "sales@demo.adept.de", "Sales123!", "Anna", "Vertrieb", "SALES");
    await this.ensureOfferTemplate(tenant.id);

    this.logger.log(
      `Demo-Login bereit: Mandant 'demo' – admin@demo.adept.de / Admin123! und sales@demo.adept.de / Sales123!`
    );
  }

  /** Legt den Nutzer nur an, wenn er fehlt – geänderte Passwörter bleiben erhalten. */
  private async ensureUser(
    tenantId: string,
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: "TENANT_ADMIN" | "SALES"
  ): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) return;
    await this.prisma.user.create({
      data: { tenantId, email, passwordHash: await argon2.hash(password), firstName, lastName, role },
    });
    this.logger.log(`Demo-Nutzer angelegt: ${email} (${role})`);
  }

  /** Beispiel-Angebotsvorlage, nur wenn der Mandant noch keine OFFER-Vorlage hat. */
  private async ensureOfferTemplate(tenantId: string): Promise<void> {
    const candidates = [
      process.env["TEMPLATES_DIR"],
      resolve(process.cwd(), "../../configs/templates"),
      resolve(process.cwd(), "configs/templates"),
      resolve(__dirname, "../../../../configs/templates"),
      resolve(__dirname, "../../../../../configs/templates"),
    ].filter((p): p is string => !!p);
    const dir = candidates.find((p) => existsSync(resolve(p, "beispiel-angebot.docx")));
    if (!dir) return;

    const existing = await this.prisma.documentTemplate.count({
      where: { tenantId, documentType: "OFFER" },
    });
    if (existing > 0) return;

    await this.prisma.documentTemplate.create({
      data: {
        tenantId,
        name: "Angebot Standard",
        documentType: "OFFER",
        fileName: "beispiel-angebot.docx",
        fileData: readFileSync(resolve(dir, "beispiel-angebot.docx")),
        placeholders: [
          "kunde_name", "kunde_adresse", "ansprechpartner", "angebotsnummer", "anrede", "datum",
          "lieferdatum", "zwischensumme", "zahlungsart", "rabatt", "zahlungsziel", "endbetrag", "versandart",
          "positionen", "positionen.pos", "positionen.menge", "positionen.artikel_id",
          "positionen.bezeichnung", "positionen.nettopreis",
        ],
        isDefault: true,
      },
    });
    this.logger.log("Demo-Dokumentvorlage angelegt: beispiel-angebot.docx (OFFER, Default)");
  }
}
