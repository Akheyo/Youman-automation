import { Injectable, NotFoundException, BadRequestException, HttpException, UnprocessableEntityException, Logger } from "@nestjs/common";
import { ZodError } from "zod";
import { v4 as uuid } from "uuid";
import { PrismaService } from "../../database/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";
import { AuditService } from "../audit/audit.service";
import { TemplatesService } from "../templates/templates.service";
import { resolveFieldMapping } from "../templates/document-mapper";
import { formatGermanNumber } from "../templates/formatters";
import type {
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
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService,
    private readonly audit: AuditService,
    private readonly templates: TemplatesService
  ) {}

  async executeAction(req: ActionExecutionRequest): Promise<ActionExecution> {
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

      // Surface the real reason (e.g. the ERP's validation message) to the
      // client instead of a generic 500 "unerwarteter Fehler". Validation
      // errors (parseDto) already are HttpExceptions and pass through.
      if (err instanceof HttpException) throw err;
      const code = (err as { code?: string }).code;
      throw new UnprocessableEntityException({
        message: errorMsg,
        ...(code ? { code } : {}),
      });
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
        const quoteNumber = await this.nextQuoteNumber(req.tenantId);
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
        this.logger.log(
          `Kunde-Anlage eingehend: ${JSON.stringify({ customerType: dto.customerType, name: dto.name, firstName: dto.firstName, lastName: dto.lastName })}`
        );
        return connector.createCustomer({
          tenantId: req.tenantId,
          customerNumber: dto.customerNumber ?? "",
          name: displayName,
          isCompany,
          firstName: dto.firstName,
          lastName: dto.lastName,
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
   * Fortlaufende Angebotsnummer pro Mandant im Format JJJJ-NNNN, abgeleitet aus
   * der Zahl bereits erstellter Angebote. Rein lokal – es entsteht kein
   * ERP-Auftrag; die Vorlage setzt "An-" davor ("Angebot Nr. An-2026-0001").
   */
  private async nextQuoteNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.actionExecution.count({
      where: { tenantId, actionId: "action-create-quote", status: "SUCCESS" },
    });
    return `${year}-${String(count + 1).padStart(4, "0")}`;
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
    try {
      const connector = await this.connectors.getConnector(tenantId);
      const customer = await connector.getCustomer(dto.customerId);
      kundeName = customer.name;
      const addr = customer.addresses.find((a) => a.type === "billing" && a.isDefault)
        ?? customer.addresses.find((a) => a.type === "billing")
        ?? customer.addresses[0];
      if (addr) {
        kundeAdresse = [`${addr.street} ${addr.streetNumber ?? ""}`.trim(), `${addr.zip} ${addr.city}`.trim()]
          .filter(Boolean)
          .join("\n");
      }
    } catch (err) {
      this.logger.warn(`Kundendaten für Dokument nicht ladbar: ${err instanceof Error ? err.message : err}`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const data: Record<string, unknown> = {
      angebotsnummer: quoteNumber,
      datum: new Date().toISOString().slice(0, 10),
      anrede: "Sehr geehrte Damen und Herren,",
      ansprechpartner: user ? `${user.firstName} ${user.lastName}`.trim() : "",
      kunde_name: kundeName,
      kunde_adresse: kundeAdresse,
      positionen: dto.lineItems.map((item, idx) => ({
        pos: idx + 1,
        menge: item.quantity,
        artikel_id: item.articleNumber ?? item.productId,
        bezeichnung: item.designation ?? "",
        nettopreis: formatGermanNumber(lineNet(item)),
      })),
      zwischensumme: formatGermanNumber(zwischensumme),
      rabatt: formatGermanNumber(zwischensumme - endbetrag),
      endbetrag: formatGermanNumber(endbetrag),
      lieferdatum: dto.lineItems.find((i) => i.deliveryDate)?.deliveryDate ?? "ab sofort",
      zahlungsart: "Rechnung",
      zahlungsziel: "7 Tage netto",
      versandart: "Spedition oder Selbstabholung",
    };

    const template = await this.templates.findDefault(tenantId, "OFFER");
    if (!template) {
      return {
        templateId: null,
        documentType: "OFFER",
        data,
        hint: "Keine Vorlage hinterlegt – unter Administration » Dokumentvorlagen können Sie eine .docx-Vorlage hochladen.",
      };
    }
    return { templateId: template.id, documentType: "OFFER", data };
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
    const defs = await this.prisma.actionDefinition.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }], enabled: true },
      orderBy: { sortOrder: "asc" },
    });
    return defs.map((d) => d.configJson);
  }
}
