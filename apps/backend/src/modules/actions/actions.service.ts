import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { PrismaService } from "../../database/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";
import { AuditService } from "../audit/audit.service";
import type {
  ActionExecutionRequest,
  ActionExecution,
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
    private readonly audit: AuditService
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
        payload: req.payload,
      },
    });

    try {
      const result = await this.routeAction(req);

      await this.prisma.actionExecution.update({
        where: { id: executionId },
        data: {
          status: "SUCCESS",
          result: result as Record<string, unknown>,
          completedAt: new Date(),
          durationMs: Date.now() - start,
        },
      });

      await this.audit.log({
        tenantId: req.tenantId,
        userId: req.userId,
        eventType: "ACTION_EXECUTED",
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
        eventType: "ACTION_FAILED",
        description: `Aktion '${req.actionId}' fehlgeschlagen: ${errorMsg}`,
        severity: "ERROR",
        metadata: { actionId: req.actionId, error: errorMsg },
      });

      throw err;
    }
  }

  private async routeAction(req: ActionExecutionRequest): Promise<unknown> {
    const connector = await this.connectors.getConnector(req.tenantId);

    switch (req.actionId) {
      case "action-create-quote": {
        const dto = CreateQuoteSchema.parse(req.payload);
        const draft = this.buildQuoteDraft(dto, req.tenantId, req.userId);
        const result = await connector.createQuote(draft);

        // Post-success actions
        if (dto.lineItems.length > 0) {
          await connector.createFollowUpTask({
            tenantId: req.tenantId,
            userId: req.userId,
            title: `Nachfassen: Angebot ${result.erpQuoteNumber}`,
            relatedCustomerId: dto.customerId,
            relatedQuoteId: result.erpQuoteId,
            priority: "medium",
            status: "open",
            source: "youman",
          });
        }

        return result;
      }

      case "action-create-customer": {
        const dto = CreateCustomerSchema.parse(req.payload);
        return connector.createCustomer({
          tenantId: req.tenantId,
          customerNumber: dto.customerNumber ?? "",
          name: dto.name,
          name2: dto.name2,
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
        const dto = CreateProductSchema.parse(req.payload);
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
        const dto = CreateAppointmentSchema.parse(req.payload);
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
        const dto = CreateNoteSchema.parse(req.payload);
        return connector.createNote({
          tenantId: req.tenantId,
          userId: req.userId,
          customerId: dto.customerId,
          content: dto.content,
          tags: dto.tags,
        });
      }

      case "action-create-followup": {
        const dto = CreateFollowUpSchema.parse(req.payload);
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

  private buildQuoteDraft(dto: CreateQuoteDto, tenantId: string, userId: string) {
    const totalNet = dto.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.pricePerUnit * (1 - (item.discount ?? 0) / 100),
      0
    );

    return {
      id: uuid(),
      tenantId,
      userId,
      customerId: dto.customerId,
      customerNumber: dto.customerNumber,
      customerName: dto.customerName,
      deliveryAddressId: dto.deliveryAddressId,
      currency: dto.currency,
      validUntil: dto.validUntil,
      lineItems: dto.lineItems.map((item, idx) => ({
        position: idx + 1,
        productId: item.productId,
        articleNumber: item.articleNumber,
        designation: item.designation,
        quantity: item.quantity,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        discount: item.discount,
        netTotal: item.quantity * item.pricePerUnit * (1 - (item.discount ?? 0) / 100),
        grossTotal: item.quantity * item.pricePerUnit * (1 - (item.discount ?? 0) / 100) * 1.19,
        currency: dto.currency,
        deliveryDate: item.deliveryDate,
        notes: item.notes,
      })),
      notes: dto.notes,
      totalNet,
      totalGross: totalNet * 1.19,
      status: "submitted" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getActionDefinitions(tenantId: string) {
    const defs = await this.prisma.actionDefinition.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }], enabled: true },
      orderBy: { sortOrder: "asc" },
    });
    return defs.map((d) => d.configJson);
  }
}
