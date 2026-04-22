import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ActionsService } from "../actions/actions.service";
import type { QueueItem, SyncStatus } from "@youman/shared";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly actionsService: ActionsService
  ) {}

  async enqueue(item: {
    tenantId: string;
    userId: string;
    actionId: string;
    actionName: string;
    payload: Record<string, unknown>;
    clientId: string;
    isOfflineCreated?: boolean;
    priority?: number;
  }): Promise<QueueItem> {
    const created = await this.prisma.queueItem.create({
      data: {
        tenantId: item.tenantId,
        userId: item.userId,
        actionId: item.actionId,
        actionName: item.actionName,
        payload: item.payload,
        status: "PENDING",
        priority: item.priority ?? 5,
        maxRetries: 3,
        clientId: item.clientId,
        isOfflineCreated: item.isOfflineCreated ?? false,
      },
    });

    return this.mapQueueItem(created);
  }

  async processPending(tenantId: string): Promise<{ processed: number; failed: number }> {
    const pending = await this.prisma.queueItem.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING", "RETRYING"] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 20,
    });

    let processed = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        await this.prisma.queueItem.update({
          where: { id: item.id },
          data: { status: "PROCESSING", processedAt: new Date() },
        });

        await this.actionsService.executeAction({
          actionId: item.actionId,
          tenantId: item.tenantId,
          userId: item.userId,
          payload: item.payload as Record<string, unknown>,
          clientTimestamp: item.createdAt.toISOString(),
          offlineQueueId: item.id,
        });

        await this.prisma.queueItem.update({
          where: { id: item.id },
          data: { status: "SUCCESS", completedAt: new Date() },
        });

        processed++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const newRetryCount = item.retryCount + 1;
        const isDead = newRetryCount >= item.maxRetries;

        const nextRetryAt = isDead
          ? null
          : new Date(Date.now() + Math.pow(2, newRetryCount) * 2000);

        await this.prisma.queueItem.update({
          where: { id: item.id },
          data: {
            status: isDead ? "DEAD_LETTER" : "RETRYING",
            retryCount: newRetryCount,
            error: errorMsg,
            nextRetryAt,
          },
        });

        this.logger.warn(`Queue item ${item.id} failed (attempt ${newRetryCount}): ${errorMsg}`);
        failed++;
      }
    }

    return { processed, failed };
  }

  async syncFromClient(items: Array<{
    clientId: string;
    actionId: string;
    actionName: string;
    payload: Record<string, unknown>;
    createdOfflineAt: string;
  }>, tenantId: string, userId: string): Promise<{ queued: number; skipped: number }> {
    let queued = 0;
    let skipped = 0;

    for (const item of items) {
      const exists = await this.prisma.queueItem.findFirst({
        where: { clientId: item.clientId, tenantId },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await this.enqueue({
        tenantId,
        userId,
        actionId: item.actionId,
        actionName: item.actionName,
        payload: item.payload,
        clientId: item.clientId,
        isOfflineCreated: true,
      });

      queued++;
    }

    // Process immediately after sync
    await this.processPending(tenantId);

    return { queued, skipped };
  }

  async getStatus(tenantId: string, userId: string): Promise<SyncStatus> {
    const [pending, failed, processing] = await Promise.all([
      this.prisma.queueItem.count({ where: { tenantId, userId, status: { in: ["PENDING", "RETRYING"] } } }),
      this.prisma.queueItem.count({ where: { tenantId, userId, status: "DEAD_LETTER" } }),
      this.prisma.queueItem.count({ where: { tenantId, userId, status: "PROCESSING" } }),
    ]);

    const lastSuccess = await this.prisma.queueItem.findFirst({
      where: { tenantId, userId, status: "SUCCESS" },
      orderBy: { completedAt: "desc" },
    });

    return {
      isOnline: true,
      lastSyncAt: lastSuccess?.completedAt?.toISOString() ?? null,
      pendingCount: pending,
      failedCount: failed,
      processingCount: processing,
      successCount: 0,
      isSyncing: processing > 0,
    };
  }

  async getItems(tenantId: string, userId: string, status?: string) {
    const items = await this.prisma.queueItem.findMany({
      where: {
        tenantId,
        userId,
        ...(status ? { status: status as Parameters<typeof this.prisma.queueItem.findMany>[0]["where"]["status"] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return items.map(this.mapQueueItem);
  }

  async retry(itemId: string, tenantId: string): Promise<void> {
    await this.prisma.queueItem.update({
      where: { id: itemId, tenantId },
      data: { status: "PENDING", retryCount: 0, error: null, nextRetryAt: null },
    });
  }

  async cancel(itemId: string, tenantId: string): Promise<void> {
    await this.prisma.queueItem.update({
      where: { id: itemId, tenantId },
      data: { status: "CANCELLED" },
    });
  }

  private mapQueueItem(raw: {
    id: string; tenantId: string; userId: string; actionId: string;
    actionName: string; payload: unknown; status: string; priority: number;
    retryCount: number; maxRetries: number; nextRetryAt: Date | null;
    error: string | null; errorCode: string | null; createdAt: Date;
    processedAt: Date | null; completedAt: Date | null; result: unknown;
    clientId: string; isOfflineCreated: boolean;
  }): QueueItem {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      userId: raw.userId,
      actionId: raw.actionId,
      actionName: raw.actionName,
      payload: raw.payload as Record<string, unknown>,
      status: raw.status.toLowerCase() as QueueItem["status"],
      priority: raw.priority,
      retryCount: raw.retryCount,
      maxRetries: raw.maxRetries,
      nextRetryAt: raw.nextRetryAt?.toISOString() ?? null,
      error: raw.error,
      errorCode: raw.errorCode,
      createdAt: raw.createdAt.toISOString(),
      processedAt: raw.processedAt?.toISOString() ?? null,
      completedAt: raw.completedAt?.toISOString() ?? null,
      result: raw.result as Record<string, unknown> | null,
      clientId: raw.clientId,
      isOfflineCreated: raw.isOfflineCreated,
    };
  }
}
