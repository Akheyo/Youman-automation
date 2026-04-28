import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import { v4 as uuid } from "uuid";
import type { QueueItem } from "@youman/shared";

type QueueItemRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  action_id: string;
  action_name: string;
  payload: string;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  error: string | null;
  error_code: string | null;
  created_at: string;
  processed_at: string | null;
  completed_at: string | null;
  result: string | null;
  client_id: string;
  is_offline_created: number;
};

export class OfflineQueueStore {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath("userData"), "adept_offline_queue.db");
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queue_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        action_name TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 5,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        next_retry_at TEXT,
        error TEXT,
        error_code TEXT,
        created_at TEXT NOT NULL,
        processed_at TEXT,
        completed_at TEXT,
        result TEXT,
        client_id TEXT NOT NULL,
        is_offline_created INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_items(status);
      CREATE INDEX IF NOT EXISTS idx_queue_tenant ON queue_items(tenant_id);
    `);
  }

  enqueue(item: {
    tenantId: string;
    userId: string;
    actionId: string;
    actionName: string;
    payload: Record<string, unknown>;
    priority?: number;
  }): QueueItem {
    const id = uuid();
    const now = new Date().toISOString();
    const clientId = uuid();

    const stmt = this.db.prepare(`
      INSERT INTO queue_items (id, tenant_id, user_id, action_id, action_name, payload, status, priority, created_at, client_id, is_offline_created)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 1)
    `);

    stmt.run(
      id,
      item.tenantId,
      item.userId,
      item.actionId,
      item.actionName,
      JSON.stringify(item.payload),
      item.priority ?? 5,
      now,
      clientId
    );

    return this.mapRow(this.db.prepare("SELECT * FROM queue_items WHERE id = ?").get(id) as QueueItemRow);
  }

  getAll(): QueueItem[] {
    const rows = this.db.prepare("SELECT * FROM queue_items ORDER BY created_at DESC LIMIT 200").all() as QueueItemRow[];
    return rows.map(this.mapRow);
  }

  getPending(): QueueItem[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM queue_items WHERE status IN ('pending', 'retrying') ORDER BY priority ASC, created_at ASC"
      )
      .all() as QueueItemRow[];
    return rows.map(this.mapRow);
  }

  markSynced(id: string): void {
    this.db
      .prepare("UPDATE queue_items SET status = 'success', completed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  }

  markFailed(id: string, error: string): void {
    const item = this.db.prepare("SELECT * FROM queue_items WHERE id = ?").get(id) as QueueItemRow | undefined;
    if (!item) return;

    const newRetryCount = item.retry_count + 1;
    const isDead = newRetryCount >= item.max_retries;

    this.db
      .prepare(
        "UPDATE queue_items SET status = ?, retry_count = ?, error = ?, next_retry_at = ? WHERE id = ?"
      )
      .run(
        isDead ? "dead_letter" : "retrying",
        newRetryCount,
        error,
        isDead ? null : new Date(Date.now() + Math.pow(2, newRetryCount) * 2000).toISOString(),
        id
      );
  }

  remove(id: string): void {
    this.db.prepare("DELETE FROM queue_items WHERE id = ?").run(id);
  }

  clear(): void {
    this.db.prepare("DELETE FROM queue_items WHERE status IN ('success', 'cancelled')").run();
  }

  private mapRow(row: QueueItemRow): QueueItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      actionId: row.action_id,
      actionName: row.action_name,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      status: row.status as QueueItem["status"],
      priority: row.priority,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      nextRetryAt: row.next_retry_at,
      error: row.error,
      errorCode: row.error_code,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      completedAt: row.completed_at,
      result: row.result ? (JSON.parse(row.result) as Record<string, unknown>) : null,
      clientId: row.client_id,
      isOfflineCreated: row.is_offline_created === 1,
    };
  }
}
