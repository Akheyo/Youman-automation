import { app, BrowserWindow, ipcMain, shell, nativeTheme } from "electron";
import path from "path";
import { setupIpcHandlers } from "./ipc/handlers";
import { OfflineQueueStore } from "./store/OfflineQueueStore";
import { SecureStorage } from "./store/SecureStorage";

const isDev = process.env.NODE_ENV === "development";
const queueStore = new OfflineQueueStore();
const secureStorage = new SecureStorage();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Youman",
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0f172a",
      symbolColor: "#94a3b8",
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    backgroundColor: "#0f172a",
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
  nativeTheme.themeSource = "dark";
  createWindow();
  setupIpcHandlers(ipcMain, queueStore, secureStorage);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Security: prevent new window creation
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
