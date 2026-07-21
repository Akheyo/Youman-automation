import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { AuditEventType } from "@youman/shared";

interface LogAuditParams {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  eventType: AuditEventType;
  resourceType?: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
}

// Map shared string enum to Prisma enum
const EVENT_MAP: Record<AuditEventType, string> = {
  "user.login": "USER_LOGIN",
  "user.logout": "USER_LOGOUT",
  "user.login_failed": "USER_LOGIN_FAILED",
  "action.executed": "ACTION_EXECUTED",
  "action.failed": "ACTION_FAILED",
  "action.queued": "ACTION_QUEUED",
  "action.synced": "ACTION_SYNCED",
  "customer.created": "CUSTOMER_CREATED",
  "customer.updated": "CUSTOMER_UPDATED",
  "product.created": "PRODUCT_CREATED",
  "product.updated": "PRODUCT_UPDATED",
  "quote.created": "QUOTE_CREATED",
  "quote.submitted": "QUOTE_SUBMITTED",
  "order.created": "ORDER_CREATED",
  "tenant.settings_changed": "TENANT_SETTINGS_CHANGED",
  "user.created": "USER_CREATED",
  "user.role_changed": "USER_ROLE_CHANGED",
  "connector.configured": "CONNECTOR_CONFIGURED",
  "system.error": "SYSTEM_ERROR",
  "template.uploaded": "TEMPLATE_UPLOADED",
  "template.updated": "TEMPLATE_UPDATED",
  "template.deleted": "TEMPLATE_DELETED",
  "document.rendered": "DOCUMENT_RENDERED",
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogAuditParams): Promise<void> {
    try {
      const prismaEventType = EVENT_MAP[params.eventType] ?? "SYSTEM_ERROR";
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId ?? null,
          userEmail: params.userEmail ?? null,
          eventType: prismaEventType as Parameters<typeof this.prisma.auditLog.create>[0]["data"]["eventType"],
          resourceType: params.resourceType ?? null,
          resourceId: params.resourceId ?? null,
          description: params.description,
          metadata: (params.metadata ?? {}) as unknown as import("@prisma/client").Prisma.InputJsonValue,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          severity: (params.severity ?? "INFO") as "INFO" | "WARNING" | "ERROR" | "CRITICAL",
        },
      });
    } catch (err) {
      this.logger.error("Failed to write audit log", err);
    }
  }

  async query(tenantId: string, params: {
    userId?: string;
    page?: number;
    pageSize?: number;
    fromDate?: string;
    toDate?: string;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 50, 100);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { tenantId };
    if (params.userId) where["userId"] = params.userId;
    if (params.fromDate || params.toDate) {
      where["createdAt"] = {
        ...(params.fromDate ? { gte: new Date(params.fromDate) } : {}),
        ...(params.toDate ? { lte: new Date(params.toDate) } : {}),
      };
    }

    const [total, items] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.prisma.auditLog.count({ where: where as any }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.prisma.auditLog.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
