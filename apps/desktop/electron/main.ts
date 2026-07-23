import { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";
import { setupIpcHandlers } from "./ipc/handlers";
import { OfflineQueueStore, createUnavailableQueueStore, type QueueStoreLike } from "./store/OfflineQueueStore";
import { SecureStorage, createUnavailableSecureStorage, type SecureStorageLike } from "./store/SecureStorage";
import { logToFile, describeError } from "./logger";

const isDev = process.env.NODE_ENV === "development";

// ── Globale Auffangnetze ──────────────────────────────────────────────────────
// Ein Fehler im Main-Prozess darf die App nicht kommentarlos abreißen: in die
// Logdatei schreiben und weiterlaufen. Nur wenn noch kein Fenster existiert
// (Startphase), dem Nutzer eine Fehlbox zeigen und kontrolliert beenden.
process.on("uncaughtException", (err) => {
  logToFile("error", `uncaughtException: ${describeError(err)}`);
  if (BrowserWindow.getAllWindows().length === 0 && app.isReady()) {
    dialog.showErrorBox(
      "adept& konnte nicht gestartet werden",
      "Beim Start ist ein Fehler aufgetreten. Details stehen in der Logdatei (logs/main.log im Anwendungsordner)."
    );
    app.exit(1);
  }
});

process.on("unhandledRejection", (reason) => {
  logToFile("error", `unhandledRejection: ${describeError(reason)}`);
});

// ── Lokale Speicher (SQLite) ──────────────────────────────────────────────────
// Eine korrupte/gesperrte Datenbank darf den App-Start nicht verhindern: die
// App läuft dann ohne Offline-Queue bzw. ohne gespeicherte Zugangsdaten weiter
// und meldet das sauber, statt vor dem ersten Fenster hart zu crashen.
let queueStore: QueueStoreLike;
let secureStorage: SecureStorageLike;

function initStores(): void {
  try {
    queueStore = new OfflineQueueStore();
  } catch (err) {
    logToFile("error", `Offline-Queue-Datenbank nicht verfügbar: ${describeError(err)}`);
    queueStore = createUnavailableQueueStore();
  }
  try {
    secureStorage = new SecureStorage();
  } catch (err) {
    logToFile("error", `Credential-Speicher nicht verfügbar: ${describeError(err)}`);
    secureStorage = createUnavailableSecureStorage();
  }
}

let mainWindow: BrowserWindow | null = null;

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("app:update", { type: "available", version: info.version });
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("app:update", { type: "downloaded", version: info.version });
  });

  autoUpdater.on("error", (err) => {
    logToFile("warn", `AutoUpdater: ${err.message}`);
    mainWindow?.webContents.send("app:update", { type: "error", message: err.message });
  });

  // Check on startup, then every 4 hours. Die Promises werden explizit
  // gefangen: ein Netzwerk-/Signaturfehler ist kein Grund für eine
  // unhandledRejection (das error-Event oben informiert den Renderer).
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    logToFile("warn", `Update-Check fehlgeschlagen: ${describeError(err)}`);
  });
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      logToFile("warn", `Update-Check fehlgeschlagen: ${describeError(err)}`);
    });
  }, 4 * 60 * 60 * 1000);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "adept&",
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#ffffff",
      symbolColor: "#3d3835",
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    backgroundColor: "#f9f7f5",
    show: false,
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173").catch((err) => {
      logToFile("error", `Dev-Server nicht erreichbar: ${describeError(err)}`);
    });
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html")).catch((err) => {
      logToFile("error", `App-Bundle konnte nicht geladen werden: ${describeError(err)}`);
      dialog.showErrorBox(
        "adept& konnte nicht geladen werden",
        "Die Anwendungsdateien fehlen oder sind beschädigt. Bitte die App neu installieren."
      );
    });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url).catch((err) => {
      logToFile("warn", `Externer Link konnte nicht geöffnet werden: ${describeError(err)}`);
    });
    return { action: "deny" };
  });
}

app
  .whenReady()
  .then(() => {
    nativeTheme.themeSource = "light";
    initStores();
    createWindow();
    setupIpcHandlers(ipcMain, queueStore, secureStorage);

    if (!isDev) {
      setupAutoUpdater();
    }

    ipcMain.handle("app:checkForUpdates", async () => {
      if (isDev) return;
      try {
        await autoUpdater.checkForUpdatesAndNotify();
      } catch (err) {
        logToFile("warn", `Manueller Update-Check fehlgeschlagen: ${describeError(err)}`);
      }
    });

    ipcMain.handle("app:installUpdate", () => {
      try {
        autoUpdater.quitAndInstall();
      } catch (err) {
        // Wirft z. B. wenn kein Update heruntergeladen ist – an den Renderer
        // melden statt still zu scheitern (der Button setzt sich dann zurück).
        logToFile("warn", `quitAndInstall fehlgeschlagen: ${describeError(err)}`);
        throw new Error("Das Update konnte nicht installiert werden. Bitte die App neu starten und erneut versuchen.");
      }
    });
  })
  .catch((err) => {
    logToFile("error", `App-Start fehlgeschlagen: ${describeError(err)}`);
    dialog.showErrorBox(
      "adept& konnte nicht gestartet werden",
      "Beim Start ist ein Fehler aufgetreten. Details stehen in der Logdatei (logs/main.log im Anwendungsordner)."
    );
    app.exit(1);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (event, url) => {
    const allowed = isDev ? ["http://localhost:5173"] : ["app://localhost"];
    const isAllowed = allowed.some((origin) => url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
      void shell.openExternal(url).catch((err) => {
        logToFile("warn", `Externer Link konnte nicht geöffnet werden: ${describeError(err)}`);
      });
    }
  });
});
