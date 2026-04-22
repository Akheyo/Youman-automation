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
