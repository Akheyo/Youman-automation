/**
 * Storage-Abstraktion: nutzt Tauri-Filesystem (mit OneDrive-Auto-Sync), wenn die App
 * als Desktop-Anwendung läuft, sonst LocalStorage als Fallback (Web-Dev-Server).
 *
 * Datei-Pfad: %USERPROFILE%\Documents\DAEV Margin Tool\daten.json
 *
 * Wenn der Documents-Ordner via OneDrive synchronisiert wird (Standard auf Windows 11
 * mit Microsoft-Konto), kann der Kunde das Tool auf zwei PCs installieren und arbeitet
 * automatisch auf demselben Datenbestand.
 */

import type { Vehicle, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

const VEHICLES_KEY = 'daev.vehicles.v1';
const SETTINGS_KEY = 'daev.settings.v1';
const LEGACY_VEHICLES_KEY = 'youman.vehicles.v1';
const LEGACY_SETTINGS_KEY = 'youman.settings.v1';

const DATA_DIR = 'DAEV Margin Tool';
const DATA_FILE = 'daten.json';

interface FileContent {
  version: 1;
  updatedAt: string;
  settings: Settings;
  vehicles: Vehicle[];
}

export interface LoadResult {
  vehicles: Vehicle[];
  settings: Settings;
  /** Pfad zur Datei (nur in Tauri-Mode), sonst null. */
  filePath: string | null;
  /** Letzter Schreib-Zeitstempel der gelesenen Datei (für Konflikt-Erkennung). */
  fileTimestamp: string | null;
}

/* ------------------------------------------------------------------ */
/* Tauri-Erkennung                                                    */
/* ------------------------------------------------------------------ */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/* ------------------------------------------------------------------ */
/* LocalStorage-Strategie (Fallback für Web-Preview / Browser-Dev)    */
/* ------------------------------------------------------------------ */

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function migrateLegacy(currentKey: string, legacyKey: string): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(currentKey) != null) return;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy != null) localStorage.setItem(currentKey, legacy);
}

function loadFromLocalStorage(): LoadResult {
  migrateLegacy(VEHICLES_KEY, LEGACY_VEHICLES_KEY);
  migrateLegacy(SETTINGS_KEY, LEGACY_SETTINGS_KEY);
  const vehicles = safeParse<Vehicle[]>(localStorage.getItem(VEHICLES_KEY), []);
  const storedSettings = safeParse<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY), {});
  return {
    vehicles,
    settings: { ...DEFAULT_SETTINGS, ...storedSettings },
    filePath: null,
    fileTimestamp: null,
  };
}

function saveToLocalStorage(vehicles: Vehicle[], settings: Settings): void {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* ------------------------------------------------------------------ */
/* Tauri-FS-Strategie                                                 */
/* ------------------------------------------------------------------ */

let cachedFilePath: string | null = null;

async function getFilePath(): Promise<string> {
  if (cachedFilePath) return cachedFilePath;
  const { documentDir, join } = await import('@tauri-apps/api/path');
  const docDir = await documentDir();
  const dirPath = await join(docDir, DATA_DIR);
  const filePath = await join(dirPath, DATA_FILE);
  cachedFilePath = filePath;
  return filePath;
}

async function ensureDataDir(): Promise<void> {
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
  const { documentDir, join } = await import('@tauri-apps/api/path');
  const docDir = await documentDir();
  const dirPath = await join(docDir, DATA_DIR);
  if (!(await exists(dirPath))) {
    await mkdir(dirPath, { recursive: true });
  }
}

async function loadFromTauri(): Promise<LoadResult> {
  const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
  const filePath = await getFilePath();

  // Erstmaliger Start: noch keine Datei vorhanden
  if (!(await exists(filePath))) {
    // Migration: alte LocalStorage-Daten übernehmen, falls vorhanden
    const fromLs = loadFromLocalStorage();
    return { ...fromLs, filePath, fileTimestamp: null };
  }

  const content = await readTextFile(filePath);
  let parsed: Partial<FileContent> = {};
  try {
    parsed = JSON.parse(content) as Partial<FileContent>;
  } catch {
    // Datei korrupt → Backup anlegen, frisch starten
    const { rename } = await import('@tauri-apps/plugin-fs');
    const backup = `${filePath}.corrupt-${Date.now()}.bak`;
    try {
      await rename(filePath, backup);
    } catch {
      // ignore
    }
    return {
      vehicles: [],
      settings: DEFAULT_SETTINGS,
      filePath,
      fileTimestamp: null,
    };
  }

  return {
    vehicles: Array.isArray(parsed.vehicles) ? (parsed.vehicles as Vehicle[]) : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    filePath,
    fileTimestamp: parsed.updatedAt ?? null,
  };
}

async function saveToTauri(vehicles: Vehicle[], settings: Settings): Promise<string> {
  const { writeTextFile, rename, exists, remove } = await import('@tauri-apps/plugin-fs');
  await ensureDataDir();
  const filePath = await getFilePath();
  const updatedAt = new Date().toISOString();
  const payload: FileContent = { version: 1, updatedAt, settings, vehicles };
  const json = JSON.stringify(payload, null, 2);

  // Atomares Schreiben: erst .tmp, dann umbenennen
  const tmpPath = `${filePath}.tmp`;
  await writeTextFile(tmpPath, json);
  if (await exists(filePath)) {
    try {
      await remove(filePath);
    } catch {
      // ignore — kann passieren wenn OneDrive die Datei kurz blockt
    }
  }
  await rename(tmpPath, filePath);
  return updatedAt;
}

/* ------------------------------------------------------------------ */
/* Öffentliche API                                                    */
/* ------------------------------------------------------------------ */

export async function loadAll(): Promise<LoadResult> {
  if (isTauri()) {
    try {
      return await loadFromTauri();
    } catch (e) {
      console.error('Tauri-FS-Load fehlgeschlagen, falle auf LocalStorage zurück:', e);
      return loadFromLocalStorage();
    }
  }
  return loadFromLocalStorage();
}

export async function saveAll(
  vehicles: Vehicle[],
  settings: Settings,
): Promise<{ filePath: string | null; timestamp: string }> {
  const timestamp = new Date().toISOString();
  if (isTauri()) {
    try {
      const ts = await saveToTauri(vehicles, settings);
      // zusätzlich in LocalStorage spiegeln, damit ein Reload schnell ist
      saveToLocalStorage(vehicles, settings);
      return { filePath: cachedFilePath, timestamp: ts };
    } catch (e) {
      console.error('Tauri-FS-Save fehlgeschlagen, schreibe nur in LocalStorage:', e);
      saveToLocalStorage(vehicles, settings);
      return { filePath: null, timestamp };
    }
  }
  saveToLocalStorage(vehicles, settings);
  return { filePath: null, timestamp };
}

export async function getStorageLocationLabel(): Promise<string> {
  if (!isTauri()) return 'Browser-LocalStorage (lokal, kein Sync)';
  try {
    return await getFilePath();
  } catch {
    return 'Tauri-FS (Pfad konnte nicht ermittelt werden)';
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Manueller Export / Import (für Sync zwischen PCs ohne OneDrive)    */
/* ------------------------------------------------------------------ */

export interface BackupBlob {
  version: 1;
  exportedAt: string;
  settings: Settings;
  vehicles: Vehicle[];
}

function buildBackupBlob(vehicles: Vehicle[], settings: Settings): BackupBlob {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    vehicles,
  };
}

function suggestedFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `daev-margin-backup-${stamp}.json`;
}

/**
 * Speichert alle Daten in eine vom Benutzer gewählte JSON-Datei.
 * In Tauri: nativer "Speichern unter"-Dialog.
 * Im Browser: Download über data-URL.
 */
export async function exportToFile(
  vehicles: Vehicle[],
  settings: Settings,
): Promise<{ saved: boolean; path: string | null }> {
  const json = JSON.stringify(buildBackupBlob(vehicles, settings), null, 2);

  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      title: 'Datensicherung speichern',
      defaultPath: suggestedFilename(),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!path) return { saved: false, path: null };
    await writeTextFile(path, json);
    return { saved: true, path };
  }

  // Browser-Fallback: Download via <a>-Tag
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { saved: true, path: null };
}

/**
 * Lädt Daten aus einer JSON-Datei.
 * In Tauri: nativer "Datei öffnen"-Dialog.
 * Im Browser: über ein verstecktes <input type="file">.
 */
export async function importFromFile(): Promise<BackupBlob | null> {
  let content: string | null = null;

  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await open({
      title: 'Datensicherung wählen',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
    });
    if (!path || Array.isArray(path)) return null;
    content = await readTextFile(path);
  } else {
    // Browser-Fallback
    content = await pickFileBrowser();
    if (content == null) return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as Partial<BackupBlob>).vehicles)
  ) {
    throw new Error('Die Datei enthält keine gültigen Fahrzeug-Daten.');
  }
  const obj = parsed as Partial<BackupBlob>;
  return {
    version: 1,
    exportedAt: obj.exportedAt ?? new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS, ...(obj.settings ?? {}) },
    vehicles: obj.vehicles as Vehicle[],
  };
}

function pickFileBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}
