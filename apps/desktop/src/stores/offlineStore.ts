import { create } from "zustand";
import type { SyncStatus, QueueItem } from "@youman/shared";

interface OfflineState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  localQueueItems: QueueItem[];
  isSyncing: boolean;
  setOnline: (online: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLocalQueue: (items: QueueItem[]) => void;
  addToLocalQueue: (item: QueueItem) => void;
  removeFromLocalQueue: (id: string) => void;
  setIsSyncing: (syncing: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  syncStatus: {
    isOnline: true,
    lastSyncAt: null,
    pendingCount: 0,
    failedCount: 0,
    processingCount: 0,
    successCount: 0,
    isSyncing: false,
  },
  localQueueItems: [],
  isSyncing: false,

  setOnline: (isOnline) => set((s) => ({ isOnline, syncStatus: { ...s.syncStatus, isOnline } })),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLocalQueue: (localQueueItems) => set({ localQueueItems }),
  addToLocalQueue: (item) => set((s) => ({ localQueueItems: [item, ...s.localQueueItems] })),
  removeFromLocalQueue: (id) =>
    set((s) => ({ localQueueItems: s.localQueueItems.filter((i) => i.id !== id) })),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
}));
