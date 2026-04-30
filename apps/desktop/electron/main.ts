import { app, BrowserWindow, ipcMain, shell, nativeTheme } from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";
import { setupIpcHandlers } from "./ipc/handlers";
import { OfflineQueueStore } from "./store/OfflineQueueStore";
import { SecureStorage } from "./store/SecureStorage";
import { SettingsStore } from "./store/SettingsStore";

const isDev = process.env.NODE_ENV === "development";
const queueStore = new OfflineQueueStore();
const secureStorage = new SecureStorage();
const settingsStore = new SettingsStore();

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
    mainWindow?.webContents.send("app:update", { type: "error", message: err.message });
  });

  // Check on startup, then every 4 hours
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
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
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  nativeTheme.themeSource = "light";
  createWindow();
  setupIpcHandlers(ipcMain, queueStore, secureStorage, settingsStore);

  if (!isDev) {
    setupAutoUpdater();
  }

  ipcMain.handle("app:checkForUpdates", () => {
    if (!isDev) autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.handle("app:installUpdate", () => {
    autoUpdater.quitAndInstall();
  });
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
      shell.openExternal(url);
    }
  });
});
