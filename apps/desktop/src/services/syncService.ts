import { apiClient } from "./api";
import { useOfflineStore } from "../stores/offlineStore";
import { useAuthStore } from "../stores/authStore";
import { withRetry } from "@youman/shared";
import { toast } from "../hooks/useToast";
import type { SyncStatus, QueueItem } from "@youman/shared";

const SYNC_INTERVAL_MS = 10_000;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
/** Zähler für Sync-Fehlschläge in Folge – steuert die einmalige Warnung. */
let consecutiveSyncFailures = 0;

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
    } catch (err) {
      // Im Browser-Dev-Modus normal; in der App ein echtes Problem (z. B.
      // SQLite defekt) – sichtbar machen statt still zu schlucken.
      console.error("[syncService] Lokale Queue nicht ladbar:", err);
    }
  },

  async enqueueOffline(item: {
    actionId: string;
    actionName: string;
    payload: Record<string, unknown>;
  }): Promise<QueueItem | null> {
    const { user, tenant } = useAuthStore.getState();
    if (!user || !tenant || !window.adept) return null;

    try {
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
    } catch (err) {
      // SQLite-Schreibfehler o. ä.: null zurückgeben – der Aufrufer meldet
      // dann klar, dass die Aktion NICHT gespeichert wurde (kein stiller
      // Datenverlust).
      console.error("[syncService] Offline-Speichern fehlgeschlagen:", err);
      return null;
    }
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
      // Retry mit Backoff nur für transiente Fehler (Netzwerk/Timeout/429/5xx).
      // Der Sync ist serverseitig über clientId dedupliziert und damit
      // gefahrlos wiederholbar.
      await withRetry(() =>
        apiClient.post("/queue/sync", {
          items: pending.map((item) => ({
            clientId: item.clientId,
            actionId: item.actionId,
            actionName: item.actionName,
            payload: item.payload,
            createdOfflineAt: item.createdAt,
          })),
        })
      );

      // Mark synced items locally
      for (const item of pending) {
        await window.adept?.queue.markSynced(item.id);
      }

      await this.loadLocalQueue();
      await this.fetchServerStatus();
      consecutiveSyncFailures = 0;
    } catch (err) {
      // Nächster Zyklus versucht es erneut – aber nicht mehr unsichtbar:
      // protokollieren und nach 3 Fehlschlägen in Folge einmalig warnen.
      consecutiveSyncFailures += 1;
      console.error(`[syncService] Sync fehlgeschlagen (${consecutiveSyncFailures}x in Folge):`, err);
      if (consecutiveSyncFailures === 3) {
        toast({
          title: "Synchronisation gestört",
          description:
            "Offline gespeicherte Aktionen konnten mehrfach nicht übertragen werden. Es wird automatisch weiter versucht – Details in der Warteschlange.",
          variant: "warning",
        });
      }
    } finally {
      useOfflineStore.getState().setIsSyncing(false);
    }
  },

  async fetchServerStatus() {
    try {
      const res = await apiClient.get<SyncStatus>("/queue/status");
      useOfflineStore.getState().setSyncStatus(res.data);
    } catch (err) {
      // Server nicht erreichbar: kein Nutzer-Alarm (Offline-Anzeige übernimmt
      // die Sidebar), aber fürs Debugging nachvollziehbar.
      console.warn("[syncService] Server-Status nicht abrufbar:", err);
    }
  },
};
