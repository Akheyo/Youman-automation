import { contextBridge, ipcRenderer } from "electron";

// Expose safe API surface to renderer via context bridge
// This is the ONLY communication channel between renderer and main process
contextBridge.exposeInMainWorld("youman", {
  // Queue operations (offline support)
  queue: {
    enqueue: (item: unknown) => ipcRenderer.invoke("queue:enqueue", item),
    getAll: () => ipcRenderer.invoke("queue:getAll"),
    getPending: () => ipcRenderer.invoke("queue:getPending"),
    markSynced: (id: string) => ipcRenderer.invoke("queue:markSynced", id),
    markFailed: (id: string, error: string) => ipcRenderer.invoke("queue:markFailed", id, error),
    remove: (id: string) => ipcRenderer.invoke("queue:remove", id),
    clear: () => ipcRenderer.invoke("queue:clear"),
  },

  // Secure credential storage
  credentials: {
    set: (key: string, value: string) => ipcRenderer.invoke("credentials:set", key, value),
    get: (key: string) => ipcRenderer.invoke("credentials:get", key),
    delete: (key: string) => ipcRenderer.invoke("credentials:delete", key),
  },

  // App utilities
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
    openExternal: (url: string) => ipcRenderer.invoke("app:openExternal", url),
    minimize: () => ipcRenderer.invoke("app:minimize"),
    maximize: () => ipcRenderer.invoke("app:maximize"),
    close: () => ipcRenderer.invoke("app:close"),
    checkOnline: () => ipcRenderer.invoke("app:checkOnline"),
  },

  // PDF
  pdf: {
    open: (url: string) => ipcRenderer.invoke("pdf:open", url),
    download: (url: string, filename: string) => ipcRenderer.invoke("pdf:download", url, filename),
  },

  // Events from main to renderer
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ["sync:status", "network:changed", "app:update"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.off(channel, callback as Parameters<typeof ipcRenderer.off>[1]);
  },
});
