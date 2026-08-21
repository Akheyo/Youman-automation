import { Injectable, BadRequestException, ConflictException, Logger } from "@nestjs/common";
import { ZodError } from "zod";
import { v4 as uuid } from "uuid";
import { PrismaService } from "../../database/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";
import { AuditService } from "../audit/audit.service";
import { TemplatesService } from "../templates/templates.service";
import { resolveFieldMapping } from "../templates/document-mapper";
import { formatNumber } from "../templates/formatters";
import { QUOTE_TEXT_DEFAULTS, QUOTE_TEXT_DEFAULTS_EN, translatePaymentMethod } from "@youman/shared";
import type {
  ActionHistoryEntry,
  QuoteLanguage,
  ActionExecutionRequest,
  ActionExecution,
  ActionDefinition,
  ExecutionDocumentInfo,
  CreateCustomerDto,
  CreateProductDto,
  CreateQuoteDto,
  CreateFollowUpDto,
  CreateAppointmentDto,
  CreateNoteDto,
  QuoteDraft,
} from "@youman/shared";
import {
  CreateCustomerSchema,
  CreateProductSchema,
  CreateQuoteSchema,
  CreateFollowUpSchema,
  CreateAppointmentSchema,
  CreateNoteSchema,
} from "@youman/shared";

@Injectable()
export class ActionsService {
  /** Nach dieser Frist gilt ein RUNNING-Idempotenz-Key als verwaist (Absturz). */
  private static readonly IDEMPOTENCY_STALE_MS = 10 * 60 * 1000;

  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService,
    private readonly audit: AuditService,
    private readonly templates: TemplatesService
  ) {}

  async executeAction(req: ActionExecutionRequest): Promise<ActionExecution> {
    // Idempotenz-Schutzschicht VOR jeder Ausführung: Derselbe Request mit
    // derselben ID liefert das gespeicherte Ergebnis zurück – es entsteht
    // kein zweiter ERP-Eintrag (z. B. kein doppelter Kontakt in Plenty).
    if (req.idempotencyKey) {
      const replay = await this.claimIdempotencyKey(req);
      if (replay) return replay;
    }
    try {
      const result = await this.executeActionInner(req);
      if (req.idempotencyKey) {
        await this.completeIdempotencyKey(req, result);
      }
      return result;
    } catch (err) {
      // Fehlgeschlagene Ausführung: Key freigeben, damit ein bewusster
      // erneuter Versuch wieder ausgeführt wird.
      if (req.idempotencyKey) {
        await this.releaseIdempotencyKey(req).catch(() => undefined);
      }
      throw err;
    }
  }

  /**
   * Reserviert die Idempotenz-ID atomar (Unique-Constraint auf tenantId+key).
   * Rückgabe: gespeichertes Ergebnis bei einem Replay, sonst undefined
   * (= Ausführung darf starten). Läuft dieselbe ID gerade noch, wird mit 409
   * abgelehnt statt doppelt auszuführen.
   */
  private async claimIdempotencyKey(req: ActionExecutionRequest): Promise<ActionExecution | undefined> {
    try {
      await this.prisma.idempotencyKey.create({
        data: { tenantId: req.tenantId, key: req.idempotencyKey!, actionId: req.actionId },
      });
      return undefined;
    } catch (err) {
      // P2002 = Unique-Verletzung: Es gibt den Key schon.
      if ((err as { code?: string }).code !== "P2002") throw err;
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { tenantId_key: { tenantId: req.tenantId, key: req.idempotencyKey! } },
      });
      if (existing?.status === "COMPLETED" && existing.result) {
        this.logger.log(
          `Idempotenz-Replay für Aktion '${req.actionId}' (key=${req.idempotencyKey}): gespeichertes Ergebnis, kein neuer ERP-Aufruf`
        );
        return existing.result as unknown as ActionExecution;
      }
      // Verwaister RUNNING-Key (Prozess-Absturz mitten in der Ausführung):
      // nach Ablauf der Stale-Frist atomar übernehmen, sonst bliebe der Key
      // für immer gesperrt. updateMany mit Bedingung verhindert, dass zwei
      // gleichzeitige Retries beide übernehmen.
      const staleCutoff = new Date(Date.now() - ActionsService.IDEMPOTENCY_STALE_MS);
      const takeover = await this.prisma.idempotencyKey.updateMany({
        where: {
          tenantId: req.tenantId,
          key: req.idempotencyKey!,
          status: "RUNNING",
          updatedAt: { lt: staleCutoff },
        },
        data: { updatedAt: new Date() },
      });
      if (takeover.count === 1) {
        this.logger.warn(
          `Verwaister Idempotenz-Key übernommen (key=${req.idempotencyKey}, Aktion '${req.actionId}') – vorherige Ausführung ist mutmaßlich abgestürzt`
        );
        return undefined;
      }
      throw new ConflictException(
        "Diese Aktion wird gerade bereits verarbeitet. Bitte einen Moment warten – sie wird nicht doppelt ausgeführt."
      );
    }
  }

  private async completeIdempotencyKey(req: ActionExecutionRequest, result: ActionExecution): Promise<void> {
    try {
      await this.prisma.idempotencyKey.update({
        where: { tenantId_key: { tenantId: req.tenantId, key: req.idempotencyKey! } },
        data: {
          status: "COMPLETED",
          executionId: result.id,
          result: result as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Ergebnis-Speicherung ist best-effort: Die Aktion IST erfolgreich –
      // schlimmstenfalls fehlt der Replay-Schutz für genau diesen Key.
      this.logger.warn(
        `Idempotenz-Ergebnis konnte nicht gespeichert werden (key=${req.idempotencyKey}): ${err instanceof Error ? err.message : err}`
      );
    }
  }

  /**
   * Verlauf der ausgeführten Aktionen eines Mandanten, neueste zuerst.
   *
   * Liest die ohnehin protokollierten ActionExecutions – der Verlauf ist damit
   * immer vollständig und braucht keine zweite Datenhaltung. Mit `actionId`
   * lässt sich auf eine Aktion einschränken, z.B. nur Angebote.
   */
  async getHistory(
    tenantId: string,
    opts: { actionId?: string; page?: number; pageSize?: number } = {}
  ): Promise<{ items: ActionHistoryEntry[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Math.trunc(opts.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(opts.pageSize ?? 25)));
    const where = {
      tenantId,
      ...(opts.actionId ? { actionId: opts.actionId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.actionExecution.count({ where }),
      this.prisma.actionExecution.findMany({
        where,
        orderBy: { executedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ]);

    return {
      items: rows.map((row) => toHistoryEntry(row)),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Nutzlast einer Ausführung, um sie als Vorlage für eine neue zu übernehmen.
   *
   * Bewusst ein eigener Aufruf statt eines Feldes in der Verlaufsliste: Die
   * Nutzlast enthält alle Positionen und wird nur gebraucht, wenn jemand
   * tatsächlich weiterarbeitet.
   */
  async getExecutionPayload(
    tenantId: string,
    id: string
  ): Promise<{ id: string; actionId: string; payload: unknown }> {
    const row = await this.prisma.actionExecution.findFirst({
      where: { id, tenantId },
      select: { id: true, actionId: true, payload: true },
    });
    if (!row) throw new BadRequestException("Vorgang nicht gefunden");
    return row;
  }

  private async releaseIdempotencyKey(req: ActionExecutionRequest): Promise<void> {
    await this.prisma.idempotencyKey.delete({
      where: { tenantId_key: { tenantId: req.tenantId, key: req.idempotencyKey! } },
    });
  }

  private async executeActionInner(req: ActionExecutionRequest): Promise<ActionExecution> {
    const start = Date.now();
    const executionId = uuid();

    const execution = await this.prisma.actionExecution.create({
      data: {
        id: executionId,
        tenantId: req.tenantId,
        userId: req.userId,
        actionId: req.actionId,
        actionName: req.actionId,
        status: "RUNNING",
        payload: req.payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    try {
      let result = (await this.routeAction(req)) as Record<string, unknown>;

      // Document generation is strictly best-effort: the ERP transaction has
      // already succeeded, so problems here must never fail the action.
      // Actions that attach their own document (e.g. Angebot) are left as-is.
      try {
        if (!("document" in result)) {
          const documentInfo = await this.buildDocumentOutput(req, result);
          if (documentInfo) result = { ...result, document: documentInfo };
        }
      } catch (err) {
        this.logger.warn(
          `Dokumentdaten für Aktion '${req.actionId}' konnten nicht aufbereitet werden: ${err instanceof Error ? err.message : err}`
        );
      }

      await this.prisma.actionExecution.update({
        where: { id: executionId },
        data: {
          status: "SUCCESS",
          result: result as unknown as import("@prisma/client").Prisma.InputJsonValue,
          completedAt: new Date(),
          durationMs: Date.now() - start,
        },
      });

      await this.audit.log({
        tenantId: req.tenantId,
        userId: req.userId,
        eventType: "action.executed",
        description: `Aktion '${req.actionId}' erfolgreich ausgeführt`,
        metadata: { actionId: req.actionId, result },
      });

      return {
        id: executionId,
        tenantId: req.tenantId,
        userId: req.userId,
        actionId: req.actionId,
        actionName: req.actionId,
        status: "success",
        payload: req.payload,
        result: result as Record<string, unknown>,
        error: null,
        retryCount: 0,
        executedAt: execution.executedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        offlineQueueId: req.offlineQueueId ?? null,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await this.prisma.actionExecution.update({
        where: { id: executionId },
        data: {
          status: "FAILED",
          error: errorMsg,
          completedAt: new Date(),
          durationMs: Date.now() - start,
        },
      });

      await this.audit.log({
        tenantId: req.tenantId,
        userId: req.userId,
        eventType: "action.failed",
        description: `Aktion '${req.actionId}' fehlgeschlagen: ${errorMsg}`,
        severity: "ERROR",
        metadata: { actionId: req.actionId, error: errorMsg },
      });

      // Kein rohes err.message mehr im Response: Der GlobalExceptionFilter
      // klassifiziert typisierte Connector-Fehler (Auth/RateLimit/NotFound/
      // Validation/NotSupported/Unreachable) zentral in Codes + deutsche
      // Meldungen; Unbekanntes wird zu INTERNAL_ERROR mit correlationId.
      // ERP-Interna (URLs, Prisma-/Axios-Text) landen nur noch im Log.
      throw err;
    }
  }

  private async routeAction(req: ActionExecutionRequest): Promise<unknown> {
    const connector = await this.connectors.getConnector(req.tenantId);

    switch (req.actionId) {
      case "action-create-quote": {
        const dto = this.parseDto(CreateQuoteSchema, req.payload);
        // Das Angebot wird NICHT im ERP als Auftrag angelegt, sondern in adept
        // als Dokument erzeugt und zum Download bereitgestellt. Aus dem ERP
        // werden nur (lesend) die Kundendaten für Name/Adresse geholt. Die
        // Dokument-Info wird hier DIREKT angehängt – unabhängig von einer
        // documentOutput-Config in der DB (die sonst per Seed gepflegt wäre).
        const quoteNumber = await this.quoteNumberFor(req.tenantId, dto, connector);
        const document = await this.buildQuoteDocument(req.tenantId, req.userId, dto, quoteNumber);
        return {
          erpQuoteId: quoteNumber,
          erpQuoteNumber: quoteNumber,
          status: "created",
          createdAt: new Date().toISOString(),
          document,
        };
      }

      case "action-create-customer": {
        const dto = this.parseDto(CreateCustomerSchema, req.payload);
        const isCompany = dto.customerType !== "person";
        const displayName = isCompany
          ? dto.name ?? ""
          : [dto.firstName, dto.lastName].filter(Boolean).join(" ");
        // Bei einer Firma sind firstName/lastName der optionale Ansprechpartner
        // (eigene Formularfelder contactFirstName/contactLastName). Bei einer
        // Privatperson sind es Vor-/Nachname des Kunden selbst.
        const contactFirstName = isCompany ? dto.contactFirstName : dto.firstName;
        const contactLastName = isCompany ? dto.contactLastName : dto.lastName;
        this.logger.log(
          `Kunde-Anlage eingehend: ${JSON.stringify({ customerType: dto.customerType, name: dto.name, firstName: contactFirstName, lastName: contactLastName })}`
        );
        return connector.createCustomer({
          tenantId: req.tenantId,
          customerNumber: dto.customerNumber ?? "",
          name: displayName,
          isCompany,
          firstName: contactFirstName,
          lastName: contactLastName,
          name2: dto.name2 ?? undefined,
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          taxNumber: dto.taxNumber,
          vatId: dto.vatId,
          currency: dto.currency,
          paymentTerms: dto.paymentTerms,
          isActive: true,
          source: "youman",
          addresses: dto.address ? [{
            id: uuid(),
            type: "billing",
            street: dto.address.street,
            streetNumber: dto.address.streetNumber,
            zip: dto.address.zip,
            city: dto.address.city,
            countryCode: dto.address.countryCode,
            state: dto.address.state,
            isDefault: true,
          }] : [],
        });
      }

      case "action-create-product": {
        const dto = this.parseDto(CreateProductSchema, req.payload);
        return connector.createProduct({
          tenantId: req.tenantId,
          articleNumber: dto.articleNumber ?? "",
          ean: dto.ean,
          designation: dto.designation,
          description: dto.description,
          manufacturer: dto.manufacturer,
          manufacturerArticleNumber: dto.manufacturerArticleNumber,
          unit: dto.unit,
          basePrice: dto.basePrice,
          currency: dto.currency,
          taxClass: dto.taxClass,
          isActive: true,
          source: "youman",
        });
      }

      case "action-create-appointment": {
        const dto = this.parseDto(CreateAppointmentSchema, req.payload);
        return connector.createAppointment({
          tenantId: req.tenantId,
          userId: req.userId,
          customerId: dto.customerId,
          title: dto.title,
          description: dto.description,
          startAt: dto.startAt,
          endAt: dto.endAt,
          location: dto.location,
          attendees: dto.attendees,
        });
      }

      case "action-create-note": {
        const dto = this.parseDto(CreateNoteSchema, req.payload);
        return connector.createNote({
          tenantId: req.tenantId,
          userId: req.userId,
          customerId: dto.customerId,
          content: dto.content,
          tags: dto.tags,
        });
      }

      case "action-create-followup": {
        const dto = this.parseDto(CreateFollowUpSchema, req.payload);
        return connector.createFollowUpTask({
          tenantId: req.tenantId,
          userId: req.userId,
          title: dto.title,
          description: dto.description,
          dueDate: dto.dueDate,
          priority: dto.priority,
          assignedToId: dto.assignedToId,
          relatedCustomerId: dto.relatedCustomerId,
          relatedQuoteId: dto.relatedQuoteId,
          status: "open",
          source: "youman",
        });
      }

      default:
        throw new BadRequestException(`Unbekannte Aktion: ${req.actionId}`);
    }
  }

  /** Zod-Fehler als 400 mit lesbarer Feldliste statt generischem 500 ausgeben. */
  private parseDto<T>(schema: { parse: (v: unknown) => T }, payload: unknown): T {
    try {
      return schema.parse(payload);
    } catch (err) {
      if (err instanceof ZodError) {
        const detail = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new BadRequestException(`Eingaben ungültig – ${detail}`);
      }
      throw err;
    }
  }

  /**
   * Liefert die Angebotsnummer – je nach Mandanten-Einstellung.
   *
   * createQuoteInErp = true: Das Angebot wird im ERP angelegt (Plenty: Beleg
   * vom Typ "Angebot"), dessen Belegnummer ist die Angebotsnummer. Damit ist
   * das Angebot im ERP sichtbar und dort weiterverarbeitbar.
   * Bewusst KEIN stiller Rückfall auf eine lokale Nummer, wenn das ERP nicht
   * erreichbar ist: Ein Dokument mit einer Nummer, zu der es im ERP keinen
   * Beleg gibt, wäre schlimmer als ein sichtbarer Fehler – die Nummer würde
   * später an einen anderen Beleg vergeben.
   *
   * createQuoteInErp = false (Standard): lokale, lückenlose Nummer.
   */
  private async quoteNumberFor(
    tenantId: string,
    dto: CreateQuoteDto,
    connector: Awaited<ReturnType<ConnectorsService["getConnector"]>>
  ): Promise<string> {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { createQuoteInErp: true },
    });
    if (!settings?.createQuoteInErp) {
      return this.nextQuoteNumber(tenantId);
    }

    const result = await connector.createQuote(this.toQuoteDraft(tenantId, dto));
    this.logger.log(`Angebot im ERP angelegt: Beleg ${result.erpQuoteNumber}`);
    return result.erpQuoteNumber;
  }

  /** Baut aus dem Formular-DTO den ERP-Entwurf für die Angebotsanlage. */
  private toQuoteDraft(tenantId: string, dto: CreateQuoteDto): QuoteDraft {
    const lineNet = (item: CreateQuoteDto["lineItems"][number]) =>
      item.quantity * item.pricePerUnit * (1 - (item.discount ?? 0) / 100);
    const totalNet = dto.lineItems.reduce((sum, item) => sum + lineNet(item), 0);
    const now = new Date().toISOString();

    return {
      id: uuid(),
      tenantId,
      userId: "",
      customerId: dto.customerId,
      customerNumber: dto.customerNumber ?? "",
      customerName: dto.customerName ?? "",
      ...(dto.deliveryAddressId ? { deliveryAddressId: dto.deliveryAddressId } : {}),
      currency: dto.currency,
      ...(dto.validUntil ? { validUntil: dto.validUntil } : {}),
      lineItems: dto.lineItems.map((item, idx) => ({
        position: idx + 1,
        productId: item.productId,
        articleNumber: item.articleNumber ?? "",
        designation: item.designation ?? "",
        quantity: item.quantity,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        ...(item.discount !== undefined ? { discount: item.discount } : {}),
        netTotal: lineNet(item),
        grossTotal: Math.round(lineNet(item) * 1.19 * 100) / 100,
        currency: dto.currency,
        ...(item.deliveryDate ? { deliveryDate: item.deliveryDate } : {}),
        ...(item.notes ? { notes: item.notes } : {}),
      })),
      ...(dto.notes ? { notes: dto.notes } : {}),
      totalNet,
      totalGross: Math.round(totalNet * 1.19 * 100) / 100,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Standardtexte des Mandanten für das Angebot (Admin » Einstellungen).
   * Jeder nicht gesetzte Wert fällt auf den früheren Festwert zurück, damit
   * bestehende Angebote unverändert aussehen. Schlägt der Zugriff fehl,
   * werden ebenfalls die Standardwerte benutzt – ein Angebot darf niemals
   * an einem fehlenden Einstellungstext scheitern.
   */
  private async quoteTexts(tenantId: string, language: QuoteLanguage = "de"): Promise<Record<keyof typeof QUOTE_TEXT_DEFAULTS, string>> {
    // Englische Angebote nutzen feste englische Texte. Die einstellbaren
    // Mandantentexte sind deutsch formuliert und passen zum deutschen
    // Briefbogen – sie in ein englisches Dokument zu übernehmen ergäbe eine
    // Mischsprache.
    if (language === "en") return QUOTE_TEXT_DEFAULTS_EN;
    try {
      const s = await this.prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: {
          quoteSalutation: true,
          quoteDeliveryDate: true,
          quotePaymentMethod: true,
          quotePaymentTerms: true,
          quoteShippingMethod: true,
        },
      });
      if (!s) return QUOTE_TEXT_DEFAULTS;
      const pick = (value: string | null | undefined, fallback: string) =>
        typeof value === "string" && value.trim() !== "" ? value : fallback;
      return {
        quoteSalutation: pick(s.quoteSalutation, QUOTE_TEXT_DEFAULTS.quoteSalutation),
        quoteDeliveryDate: pick(s.quoteDeliveryDate, QUOTE_TEXT_DEFAULTS.quoteDeliveryDate),
        quotePaymentMethod: pick(s.quotePaymentMethod, QUOTE_TEXT_DEFAULTS.quotePaymentMethod),
        quotePaymentTerms: pick(s.quotePaymentTerms, QUOTE_TEXT_DEFAULTS.quotePaymentTerms),
        quoteShippingMethod: pick(s.quoteShippingMethod, QUOTE_TEXT_DEFAULTS.quoteShippingMethod),
      };
    } catch (err) {
      this.logger.warn(`Angebotstexte nicht ladbar, Standardwerte greifen: ${err instanceof Error ? err.message : err}`);
      return QUOTE_TEXT_DEFAULTS;
    }
  }

  /**
   * Fortlaufende Angebotsnummer pro Mandant im Format JJJJ-NNNN, abgeleitet aus
   * der Zahl bereits erstellter Angebote. Rein lokal – es entsteht kein
   * ERP-Auftrag; die Vorlage setzt "An-" davor ("Angebot Nr. An-2026-0001").
   */
  private async nextQuoteNumber(tenantId: string): Promise<string> {
    // Konfigurierbare, fortlaufende Angebotsnummer: quoteNumberNext ist die
    // nächste Nummer, quoteNumberStep die Schrittweite (beides im Admin
    // einstellbar). Der atomare increment vergibt auch bei parallelen
    // Angeboten eindeutige Nummern.
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { quoteNumberStep: true },
    });
    const step = Math.max(1, settings?.quoteNumberStep ?? 1);
    try {
      const updated = await this.prisma.tenantSettings.update({
        where: { tenantId },
        data: { quoteNumberNext: { increment: step } },
        select: { quoteNumberNext: true },
      });
      const used = updated.quoteNumberNext - step;
      return String(Math.max(0, used)).padStart(4, "0");
    } catch {
      // Kein Settings-Datensatz (untypisch): stabiler zählbasierter Fallback.
      const count = await this.prisma.actionExecution.count({
        where: { tenantId, actionId: "action-create-quote", status: "SUCCESS" },
      });
      return String(1000 + count).padStart(4, "0");
    }
  }

  /**
   * Builds the complete, flat placeholder set for the Angebot template and
   * looks up the tenant's default OFFER template. Fully self-contained – no
   * dependency on a documentOutput mapping in the DB config. Amounts are
   * pre-formatted German decimals; `datum` stays ISO and is formatted at render.
   */
  private async buildQuoteDocument(
    tenantId: string,
    userId: string,
    dto: CreateQuoteDto,
    quoteNumber: string
  ): Promise<ExecutionDocumentInfo> {
    const lineNet = (item: CreateQuoteDto["lineItems"][number]) =>
      item.quantity * item.pricePerUnit * (1 - (item.discount ?? 0) / 100);
    const zwischensumme = dto.lineItems.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
    const endbetrag = dto.lineItems.reduce((sum, item) => sum + lineNet(item), 0);

    let kundeName = dto.customerName ?? "";
    let kundeAdresse = "";
    let lieferadresse = "";
    try {
      const connector = await this.connectors.getConnector(tenantId);
      const customer = await connector.getCustomer(dto.customerId);
      kundeName = customer.name;
      const addr = customer.addresses.find((a) => a.type === "billing" && a.isDefault)
        ?? customer.addresses.find((a) => a.type === "billing")
        ?? customer.addresses[0];
      if (addr) kundeAdresse = formatPostalAddress(addr);

      // Ausgewählte Lieferadresse, sonst die hinterlegte Standard-Lieferadresse.
      // Kennt der Kunde keine, gilt die Anschrift des Angebots – so bleibt der
      // Platzhalter nie leer, was das Rendern abbrechen ließe.
      const delivery = dto.deliveryAddressId
        ? customer.addresses.find((a) => String(a.id) === String(dto.deliveryAddressId))
        : undefined;
      const fallback = customer.addresses.find((a) => a.type === "shipping" && a.isDefault)
        ?? customer.addresses.find((a) => a.type === "shipping");
      lieferadresse = delivery ? formatPostalAddress(delivery) : fallback ? formatPostalAddress(fallback) : kundeAdresse;

      if (dto.deliveryAddressId && !delivery) {
        this.logger.warn(
          `Lieferadresse ${dto.deliveryAddressId} gehört nicht zu Kunde ${dto.customerId} – Standardadresse verwendet.`
        );
      }
    } catch (err) {
      this.logger.warn(`Kundendaten für Dokument nicht ladbar: ${err instanceof Error ? err.message : err}`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Standardtexte des Mandanten (Admin » Einstellungen). Fehlt der Datensatz
    // oder ein Feld, greifen exakt die früheren Festwerte – das Dokument sieht
    // dann unverändert aus.
    const texts = await this.quoteTexts(tenantId, dto.language);

    const data: Record<string, unknown> = {
      angebotsnummer: quoteNumber,
      datum: new Date().toISOString().slice(0, 10),
      anrede: texts.quoteSalutation,
      ansprechpartner: user ? `${user.firstName} ${user.lastName}`.trim() : "",
      kunde_name: kundeName,
      kunde_adresse: kundeAdresse,
      // Der im Formular bearbeitete Text gewinnt gegen die nachgeschlagene
      // Adresse – sonst bliebe die Bearbeitung ohne Wirkung.
      lieferadresse: dto.deliveryAddress?.trim() || lieferadresse || kundeAdresse,
      positionen: dto.lineItems.map((item, idx) => ({
        pos: idx + 1,
        menge: item.quantity,
        artikel_id: item.articleNumber ?? item.productId,
        bezeichnung: item.designation ?? "",
        nettopreis: formatNumber(lineNet(item), dto.language),
      })),
      zwischensumme: formatNumber(zwischensumme, dto.language),
      rabatt: formatNumber(zwischensumme - endbetrag, dto.language),
      endbetrag: formatNumber(endbetrag, dto.language),
      lieferdatum: dto.lineItems.find((i) => i.deliveryDate)?.deliveryDate ?? texts.quoteDeliveryDate,
      // Im Formular gewaehlte Zahlungsart schlaegt den Standardtext des Mandanten.
      zahlungsart: dto.paymentMethod?.trim()
        ? translatePaymentMethod(dto.paymentMethod.trim(), dto.language)
        : texts.quotePaymentMethod,
      zahlungsziel: texts.quotePaymentTerms,
      versandart: texts.quoteShippingMethod,
    };

    const template = await this.templates.findDefault(tenantId, "OFFER", dto.language);
    if (!template) {
      return {
        templateId: null,
        documentType: "OFFER",
        data,
        language: dto.language,
        hint: "Keine Vorlage hinterlegt – unter Administration » Dokumentvorlagen können Sie eine .docx-Vorlage hochladen.",
      };
    }
    return { templateId: template.id, documentType: "OFFER", data, language: dto.language };
  }

  /**
   * When the executed action declares documentOutput, resolve its fieldMapping
   * against form + result and look up the tenant's default template.
   */
  private async buildDocumentOutput(
    req: ActionExecutionRequest,
    result: Record<string, unknown>
  ): Promise<ExecutionDocumentInfo | undefined> {
    const def = await this.prisma.actionDefinition.findUnique({ where: { id: req.actionId } });
    const config = def?.configJson as ActionDefinition | undefined;
    const documentOutput = config?.documentOutput;
    if (!documentOutput) return undefined;

    const user = await this.prisma.user.findUnique({ where: { id: req.userId } });
    const data = resolveFieldMapping(documentOutput.fieldMapping, {
      form: req.payload,
      result,
      meta: {
        datum: new Date().toISOString().slice(0, 10),
        userName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
        userEmail: user?.email ?? "",
      },
    });

    const template = await this.templates.findDefault(req.tenantId, documentOutput.documentType);
    if (!template) {
      return {
        templateId: null,
        documentType: documentOutput.documentType,
        data,
        hint: "Keine Vorlage hinterlegt – unter Administration » Dokumentvorlagen können Sie eine .docx-Vorlage hochladen.",
      };
    }
    return { templateId: template.id, documentType: documentOutput.documentType, data };
  }

  async getActionDefinitions(tenantId: string) {
    const [defs, settings] = await Promise.all([
      this.prisma.actionDefinition.findMany({
        where: { OR: [{ tenantId }, { tenantId: null }], enabled: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: { quoteLineDiscount: true },
      }),
    ]);
    const configs = defs.map((d) => d.configJson);
    return settings?.quoteLineDiscount === false ? configs.map(withoutLineDiscount) : configs;
  }
}

/** Rohdaten einer Ausführung, wie sie aus Prisma kommen. */
interface ExecutionRow {
  id: string;
  actionId: string;
  actionName: string;
  status: string;
  executedAt: Date;
  durationMs: number | null;
  error: string | null;
  payload: unknown;
  result: unknown;
  user: { firstName: string | null; lastName: string | null; email: string } | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Verdichtet eine Ausführung auf die Angaben, die im Verlauf sichtbar sind.
 *
 * Die Nettosumme wird aus den Positionen der Nutzlast neu gerechnet statt aus
 * dem Ergebnis gelesen: Das Ergebnis enthält je nach Aktion keine Summe, die
 * Positionen aber immer. Rabatte werden dabei wie bei der Angebotserstellung
 * berücksichtigt.
 */
export function toHistoryEntry(row: ExecutionRow): ActionHistoryEntry {
  const payload = asRecord(row.payload);
  const result = asRecord(row.result);
  const lineItems = Array.isArray(payload["lineItems"]) ? (payload["lineItems"] as unknown[]) : [];

  let totalNet: number | null = null;
  if (lineItems.length > 0) {
    const sum = lineItems.reduce<number>((acc, raw) => {
      const item = asRecord(raw);
      const qty = asNumber(item["quantity"]) ?? 0;
      const price = asNumber(item["pricePerUnit"]) ?? 0;
      const discount = asNumber(item["discount"]) ?? 0;
      return acc + qty * price * (1 - discount / 100);
    }, 0);
    totalNet = Math.round(sum * 100) / 100;
  }

  const document = asRecord(result["document"]);
  const user = row.user;
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "–";

  return {
    id: row.id,
    actionId: row.actionId,
    actionName: row.actionName,
    status: row.status.toLowerCase() as ActionHistoryEntry["status"],
    executedAt: row.executedAt.toISOString(),
    durationMs: row.durationMs,
    error: row.error,
    referenceNumber:
      (result["erpQuoteNumber"] as string | undefined) ??
      (result["erpOrderNumber"] as string | undefined) ??
      (result["erpCustomerNumber"] as string | undefined) ??
      null,
    customerName: (payload["customerName"] as string | undefined) ?? null,
    totalNet,
    currency: (payload["currency"] as string | undefined) ?? null,
    positionCount: lineItems.length > 0 ? lineItems.length : null,
    userName,
    document: "templateId" in document ? (document as unknown as ActionHistoryEntry["document"]) : null,
  };
}

/**
 * Entfernt die Rabattspalte aus den Positionen einer Aktionsdefinition.
 *
 * Für Mandanten, die den Rabatt als eigene Artikelposition mit negativem
 * Preis führen: Eine zusätzliche Prozentspalte wäre dort doppelt gemoppelt
 * und würde am Ende zweimal Rabatt abziehen. Die Definition wird kopiert, nie
 * verändert – sie stammt aus der Datenbank und gilt für alle Mandanten.
 */
export function withoutLineDiscount(config: unknown): unknown {
  if (!config || typeof config !== "object") return config;
  const def = config as Record<string, unknown>;
  if (!Array.isArray(def["fields"])) return config;

  let touched = false;
  const fields = (def["fields"] as unknown[]).map((raw) => {
    const field = asRecord(raw);
    const columns = field["lineItemColumns"];
    if (!Array.isArray(columns)) return raw;
    const kept = columns.filter((column) => asRecord(column)["key"] !== "discount");
    if (kept.length === columns.length) return raw;
    touched = true;
    return { ...field, lineItemColumns: kept };
  });
  return touched ? { ...def, fields } : config;
}

/** Anschrift zweizeilig: Strasse mit Hausnummer, darunter PLZ und Ort. */
function formatPostalAddress(addr: {
  street: string;
  streetNumber?: string | undefined;
  zip: string;
  city: string;
}): string {
  return [`${addr.street} ${addr.streetNumber ?? ""}`.trim(), `${addr.zip} ${addr.city}`.trim()]
    .filter(Boolean)
    .join("\n");
}
