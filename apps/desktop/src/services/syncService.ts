import { apiClient } from "./api";
import { useOfflineStore } from "../stores/offlineStore";
import { useAuthStore } from "../stores/authStore";
import type { SyncStatus, QueueItem } from "@youman/shared";

const SYNC_INTERVAL_MS = 10_000;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export const syncService = {
  start() {
    this.checkOnlineStatus();
    this.loadLocalQueue();

    if (syncIntervalId) clearInterval(syncIntervalId);
    syncIntervalId = setInterval(() => {
      this.checkOnlineStatus();
      if (useOfflineStore.getState().isOnline) {
        this.sync();
      }
    }, SYNC_INTERVAL_MS);

    // Listen for network changes from Electron
    if (window.adept) {
      window.adept.on("network:changed", (isOnline: unknown) => {
        useOfflineStore.getState().setOnline(Boolean(isOnline));
        if (isOnline) this.sync();
      });
    }
  },

  stop() {
    if (syncIntervalId) clearInterval(syncIntervalId);
  },

  async checkOnlineStatus() {
    try {
      if (window.adept) {
        const online = await window.adept.app.checkOnline();
        useOfflineStore.getState().setOnline(online);
      } else {
        useOfflineStore.getState().setOnline(navigator.onLine);
      }
    } catch {
      useOfflineStore.getState().setOnline(false);
    }
  },

  async loadLocalQueue() {
    try {
      if (!window.adept) return;
      const items = await window.adept.queue.getAll();
      useOfflineStore.getState().setLocalQueue(items as QueueItem[]);
    } catch {
      // Ignore – running in browser dev mode
    }
  },

  async enqueueOffline(item: {
    actionId: string;
    actionName: string;
    payload: Record<string, unknown>;
  }): Promise<QueueItem | null> {
    const { user, tenant } = useAuthStore.getState();
    if (!user || !tenant || !window.adept) return null;

    const queued = await window.adept.queue.enqueue({
      tenantId: tenant.id,
      userId: user.id,
      actionId: item.actionId,
      actionName: item.actionName,
      payload: item.payload,
    });

    const queueItem = queued as QueueItem;
    useOfflineStore.getState().addToLocalQueue(queueItem);
    return queueItem;
  },

  async sync() {
    const { isOnline, localQueueItems, isSyncing } = useOfflineStore.getState();
    if (!isOnline || isSyncing) return;

    const pending = localQueueItems.filter((i) => i.status === "pending" || i.status === "retrying");
    if (pending.length === 0) {
      await this.fetchServerStatus();
      return;
    }

    useOfflineStore.getState().setIsSyncing(true);

    try {
      await apiClient.post("/queue/sync", {
        items: pending.map((item) => ({
          clientId: item.clientId,
          actionId: item.actionId,
          actionName: item.actionName,
          payload: item.payload,
          createdOfflineAt: item.createdAt,
        })),
      });

      // Mark synced items locally
      for (const item of pending) {
        await window.adept?.queue.markSynced(item.id);
      }

      await this.loadLocalQueue();
      await this.fetchServerStatus();
    } catch {
      // Will retry next cycle
    } finally {
      useOfflineStore.getState().setIsSyncing(false);
    }
  },

  async fetchServerStatus() {
    try {
      const res = await apiClient.get<SyncStatus>("/queue/status");
      useOfflineStore.getState().setSyncStatus(res.data);
    } catch {
      // Server unreachable
    }
  },
};
