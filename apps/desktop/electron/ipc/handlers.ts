import { IpcMain, app, shell, BrowserWindow, net, dialog } from "electron";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { OfflineQueueStore } from "../store/OfflineQueueStore";
import type { SecureStorage } from "../store/SecureStorage";

export function setupIpcHandlers(
  ipcMain: IpcMain,
  queueStore: OfflineQueueStore,
  secureStorage: SecureStorage
): void {
  // ── Queue ──────────────────────────────────────────────────────────────────
  ipcMain.handle("queue:enqueue", (_, item: unknown) => queueStore.enqueue(item as Parameters<typeof queueStore.enqueue>[0]));
  ipcMain.handle("queue:getAll", () => queueStore.getAll());
  ipcMain.handle("queue:getPending", () => queueStore.getPending());
  ipcMain.handle("queue:markSynced", (_, id: string) => queueStore.markSynced(id));
  ipcMain.handle("queue:markFailed", (_, id: string, error: string) => queueStore.markFailed(id, error));
  ipcMain.handle("queue:remove", (_, id: string) => queueStore.remove(id));
  ipcMain.handle("queue:clear", () => queueStore.clear());

  // ── Credentials ────────────────────────────────────────────────────────────
  ipcMain.handle("credentials:set", (_, key: string, value: string) => secureStorage.set(key, value));
  ipcMain.handle("credentials:get", (_, key: string) => secureStorage.get(key));
  ipcMain.handle("credentials:delete", (_, key: string) => secureStorage.delete(key));

  // ── App ────────────────────────────────────────────────────────────────────
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:openExternal", (_, url: string) => shell.openExternal(url));
  ipcMain.handle("app:minimize", () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle("app:maximize", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.handle("app:close", () => BrowserWindow.getFocusedWindow()?.close());
  ipcMain.handle("app:checkOnline", () => net.isOnline());

  // ── PDF ────────────────────────────────────────────────────────────────────
  ipcMain.handle("pdf:open", (_, url: string) => shell.openExternal(url));
  ipcMain.handle("pdf:download", (_, url: string, _filename: string) => shell.openExternal(url));

  // ── Generated documents ────────────────────────────────────────────────────
  ipcMain.handle("documents:save", async (_, fileName: string, base64: string) => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? new BrowserWindow({ show: false }), {
      defaultPath: join(app.getPath("downloads"), fileName),
      filters: fileName.toLowerCase().endsWith(".pdf")
        ? [{ name: "PDF", extensions: ["pdf"] }]
        : [{ name: "Word-Dokument", extensions: ["docx"] }],
    });
    if (canceled || !filePath) return null;
    await writeFile(filePath, Buffer.from(base64, "base64"));
    void shell.openPath(filePath);
    return filePath;
  });
}
