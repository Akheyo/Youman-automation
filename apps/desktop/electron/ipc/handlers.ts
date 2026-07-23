import { IpcMain, app, shell, BrowserWindow, net } from "electron";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import type { QueueStoreLike } from "../store/OfflineQueueStore";
import type { SecureStorageLike } from "../store/SecureStorage";
import { logToFile, describeError } from "../logger";

export function setupIpcHandlers(
  ipcMain: IpcMain,
  queueStore: QueueStoreLike,
  secureStorage: SecureStorageLike
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
  // Echter Download (vorher ein Stub, der nur den Browser öffnete und den
  // Dateinamen ignorierte): Datei in den Downloads-Ordner laden und öffnen.
  ipcMain.handle("pdf:download", async (_, url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = Buffer.from(await response.arrayBuffer());
      const dir = app.getPath("downloads");
      const safeName = (filename || "dokument.pdf").replace(/[\\/:*?"<>|]/g, "_");
      const ext = extname(safeName) || ".pdf";
      const stem = basename(safeName, extname(safeName));
      let target = join(dir, `${stem}${ext}`);
      for (let i = 1; existsSync(target); i++) {
        target = join(dir, `${stem} (${i})${ext}`);
      }
      await writeFile(target, data);
      shell
        .openPath(target)
        .then((openError) => {
          if (openError) logToFile("warn", `PDF gespeichert, aber Öffnen fehlgeschlagen: ${openError}`);
        })
        .catch((err) => logToFile("warn", `PDF gespeichert, aber Öffnen fehlgeschlagen: ${describeError(err)}`));
      return target;
    } catch (err) {
      logToFile("error", `pdf:download fehlgeschlagen (${url}): ${describeError(err)}`);
      throw new Error(
        "Das PDF konnte nicht heruntergeladen werden. Bitte Verbindung prüfen und erneut versuchen."
      );
    }
  });

  // ── Generated documents ────────────────────────────────────────────────────
  // Speichert die Datei OHNE modalen Dialog direkt in den Downloads-Ordner
  // (ein an ein unsichtbares Fenster gehängter Save-Dialog kann nie zurückkehren
  //  -> Endlos-Spinner). Kollidierende Namen werden durchnummeriert. Danach wird
  // die Datei geöffnet und der Pfad an den Renderer zurückgegeben.
  ipcMain.handle("documents:save", async (_, fileName: string, base64: string) => {
    let target = "";
    try {
      const dir = app.getPath("downloads");
      const ext = extname(fileName);
      const stem = basename(fileName, ext);
      target = join(dir, fileName);
      for (let i = 1; existsSync(target); i++) {
        target = join(dir, `${stem} (${i})${ext}`);
      }
      await writeFile(target, Buffer.from(base64, "base64"));
    } catch (err) {
      // Platte voll, Schreibrecht fehlt, defekter Buffer: sauber und deutsch
      // an den Renderer melden statt als kryptische IPC-Rejection.
      logToFile("error", `documents:save fehlgeschlagen (${fileName}): ${describeError(err)}`);
      throw new Error(
        "Das Dokument konnte nicht im Downloads-Ordner gespeichert werden. Bitte Speicherplatz und Berechtigungen prüfen und erneut versuchen."
      );
    }
    // Öffnen ist best-effort: Die Datei IST gespeichert – ein Fehler beim
    // Öffnen (kein Programm verknüpft o. ä.) darf den Erfolg nicht zunichtemachen.
    shell
      .openPath(target)
      .then((openError) => {
        if (openError) logToFile("warn", `Dokument gespeichert, aber Öffnen fehlgeschlagen: ${openError}`);
      })
      .catch((err) => logToFile("warn", `Dokument gespeichert, aber Öffnen fehlgeschlagen: ${describeError(err)}`));
    return target;
  });
}
