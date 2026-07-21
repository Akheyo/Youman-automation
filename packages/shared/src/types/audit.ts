export type AuditEventType =
  | "user.login"
  | "user.logout"
  | "user.login_failed"
  | "action.executed"
  | "action.failed"
  | "action.queued"
  | "action.synced"
  | "customer.created"
  | "customer.updated"
  | "product.created"
  | "product.updated"
  | "quote.created"
  | "quote.submitted"
  | "order.created"
  | "tenant.settings_changed"
  | "user.created"
  | "user.role_changed"
  | "connector.configured"
  | "system.error"
  | "template.uploaded"
  | "template.updated"
  | "template.deleted"
  | "document.rendered";

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  userEmail: string | null;
  eventType: AuditEventType;
  resourceType: string | null;
  resourceId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  severity: "info" | "warning" | "error" | "critical";
  createdAt: string;
}

export interface AuditQueryParams {
  tenantId: string;
  userId?: string;
  eventType?: AuditEventType;
  resourceType?: string;
  severity?: AuditLog["severity"];
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}
