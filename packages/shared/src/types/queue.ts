export type QueueItemStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "retrying"
  | "dead_letter"
  | "cancelled";

export interface QueueItem {
  id: string;
  tenantId: string;
  userId: string;
  actionId: string;
  actionName: string;
  payload: Record<string, unknown>;
  status: QueueItemStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  error: string | null;
  errorCode: string | null;
  createdAt: string;
  processedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  clientId: string;
  isOfflineCreated: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
  processingCount: number;
  successCount: number;
  isSyncing: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  retryableErrorCodes: string[];
}
