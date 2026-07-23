import type { UserRole } from "./auth";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "time"
  | "datetime"
  | "dropdown"
  | "dynamic_dropdown"
  | "searchable_select"
  | "multi_select"
  | "checkbox"
  | "radio"
  | "table_line_items"
  | "address_block"
  | "hidden";

export type OfflineBehavior = "queue" | "reject" | "local_only";
export type ActionCategory =
  | "sales"
  | "purchasing"
  | "inventory"
  | "crm"
  | "administration"
  | "logistics";

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface FieldConstraint {
  id: string;
  fieldId: string;
  type: "required" | "min" | "max" | "pattern" | "dependency" | "custom";
  value: unknown;
  message: string;
  condition?: FieldCondition;
}

export interface FieldCondition {
  fieldId: string;
  operator: "eq" | "neq" | "gt" | "lt" | "in" | "notIn" | "exists" | "notExists";
  value: unknown;
}

export interface DynamicSource {
  endpoint: string;
  searchParam: string;
  valueField: string;
  labelField: string;
  descriptionField?: string;
  minChars: number;
  debounceMs: number;
  pageSize: number;
}

export interface LineItemColumn {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  width?: number;
  dynamicSource?: DynamicSource;
}

export interface FieldDefinition {
  id: string;
  actionId: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  description?: string;
  order: number;
  groupId?: string;
  options?: FieldOption[];
  dynamicSource?: DynamicSource;
  constraints?: FieldConstraint[];
  lineItemColumns?: LineItemColumn[];
  readOnly?: boolean;
  hidden?: boolean;
  width?: "full" | "half" | "third";
}

export interface FieldGroup {
  id: string;
  label: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  order: number;
}

export interface ApiMapping {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  bodyMapping: Record<string, string>;
  responseMapping: Record<string, string>;
  headers?: Record<string, string>;
}

export interface SuccessAction {
  type:
    | "toast"
    | "navigate"
    | "open_pdf"
    | "prepare_email"
    | "create_followup"
    | "create_appointment"
    | "create_note"
    | "reserve_stock"
    | "refresh_data"
    | "execute_action";
  config: Record<string, unknown>;
  condition?: FieldCondition;
}

export interface FailureHandling {
  showErrorToast: boolean;
  logToAudit: boolean;
  retryable: boolean;
  fallbackAction?: string;
  userMessage?: string;
}

/** Document types a tenant can store templates for. */
export type DocumentType = "OFFER" | "INVOICE" | "ORDER_CONFIRMATION" | "DELIVERY_NOTE" | "OTHER";

/**
 * Mapping of a template placeholder to a value from the executed action.
 * Path syntax: "$.form.<key>" (form payload), "$.result.<key>" (connector
 * result); "<path>[*]" maps an array. Anything not starting with "$." is a
 * literal constant. Array entries use `itemMapping` with the same syntax
 * relative to the array element ("$.quantity"), plus "$pos" for the 1-based
 * index.
 */
export type DocumentFieldMapping = Record<
  string,
  string | { path: string; itemMapping: Record<string, string> }
>;

/** Optional per-action document generation config. */
export interface DocumentOutput {
  documentType: DocumentType;
  fieldMapping: DocumentFieldMapping;
}

/** Template metadata as served by the backend (fileData stays server-side). */
export interface DocumentTemplateInfo {
  id: string;
  tenantId: string;
  name: string;
  documentType: DocumentType;
  fileName: string;
  placeholders: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Attached to a successful execution result when the action has documentOutput. */
export interface ExecutionDocumentInfo {
  templateId: string | null;
  documentType: DocumentType;
  /** Placeholder data ready to POST to /templates/:id/render. */
  data: Record<string, unknown>;
  /** Set when no template is configured for the documentType. */
  hint?: string;
}

export interface ActionDefinition {
  id: string;
  tenantId: string | null;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: ActionCategory;
  targetSystem: string;
  version: string;
  enabled: boolean;
  allowedRoles: UserRole[];
  fields: FieldDefinition[];
  fieldGroups?: FieldGroup[];
  apiMapping: ApiMapping;
  successActions: SuccessAction[];
  failureHandling: FailureHandling;
  offlineBehavior: OfflineBehavior;
  documentOutput?: DocumentOutput;
  estimatedDurationMs?: number;
  tags?: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionExecutionRequest {
  actionId: string;
  tenantId: string;
  userId: string;
  payload: Record<string, unknown>;
  clientTimestamp: string;
  offlineQueueId?: string;
  /**
   * Idempotenz-Schutz für schreibende Aktionen: Der Client vergibt beim ersten
   * Absenden eine ID; ein Retry mit derselben ID liefert das gespeicherte
   * Ergebnis zurück statt einen zweiten ERP-Eintrag zu erzeugen.
   */
  idempotencyKey?: string;
}

export type ExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "queued_offline"
  | "retrying"
  | "dead_letter";

export interface ActionExecution {
  id: string;
  tenantId: string;
  userId: string;
  actionId: string;
  actionName: string;
  status: ExecutionStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  retryCount: number;
  executedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  offlineQueueId: string | null;
}
