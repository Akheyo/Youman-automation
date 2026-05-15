/**
 * Cloud-Sync gegen die Vercel-Edge-Function unter /api/data.
 *
 * Build-Konfiguration: Die Backend-URL wird aus VITE_CLOUD_URL eingelesen.
 * Wenn die App vom selben Vercel-Deployment ausgeliefert wird (Web-Modus),
 * werden relative URLs verwendet. In der Tauri-Desktop-App muss die URL
 * absolut sein.
 */

import type { Vehicle, Settings, LocalConfig } from '@/types';

/**
 * Wird beim Build-Zeitpunkt aus der Env-Variablen VITE_CLOUD_URL ersetzt.
 * Default fällt auf die im README dokumentierte Vercel-URL zurück, die
 * Akheyo nach dem Deployment anpassen kann.
 */
const ENV_URL =
  typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_CLOUD_URL
    : undefined;

export const CLOUD_BASE_URL: string =
  ENV_URL && ENV_URL.length > 0
    ? ENV_URL.replace(/\/$/, '')
    : 'https://daev-margin-tool.vercel.app';

const ENDPOINT = `${CLOUD_BASE_URL}/api/data`;

/* ------------------------------------------------------------------ */
/* Sync-Code-Generator                                                */
/* ------------------------------------------------------------------ */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ohne mehrdeutige 0/O/1/I/L

/**
 * Erzeugt einen Sync-Code im Format XXXX-XXXX-XXXX (12 Zeichen + 2 Bindestriche).
 * Entropie: 31^12 ≈ 7,9·10¹⁷ Kombinationen — praktisch unmöglich zu erraten.
 */
export function generateSyncCode(): string {
  const random = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(random);
  } else {
    for (let i = 0; i < random.length; i++) random[i] = Math.floor(Math.random() * 256);
  }
  const chars: string[] = [];
  for (let i = 0; i < random.length; i++) {
    chars.push(CODE_ALPHABET[random[i] % CODE_ALPHABET.length]);
  }
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export function normalizeSyncCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(.{4})(.{4}).*/, '$1-$2-$3');
}

export function isValidSyncCode(code: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

/* ------------------------------------------------------------------ */
/* Daten-Schema in der Cloud                                          */
/* ------------------------------------------------------------------ */

export interface CloudPayload {
  vehicles: Vehicle[];
  settings: Settings;
}

export interface CloudEntry {
  exists: boolean;
  updatedAt?: string;
  payload?: CloudPayload;
}

/* ------------------------------------------------------------------ */
/* Pull / Push                                                        */
/* ------------------------------------------------------------------ */

export class CloudSyncError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CloudSyncError';
  }
}

export async function pullFromCloud(code: string, signal?: AbortSignal): Promise<CloudEntry> {
  if (!isValidSyncCode(code)) {
    throw new CloudSyncError('Ungültiger Sync-Code.');
  }
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      signal,
      cache: 'no-store',
    });
  } catch (e) {
    throw new CloudSyncError('Keine Verbindung zum Sync-Server.', e);
  }
  if (!response.ok) {
    throw new CloudSyncError(`Sync-Server antwortete mit ${response.status}.`);
  }
  const data = (await response.json()) as CloudEntry;
  return data;
}

export async function pushToCloud(
  code: string,
  payload: CloudPayload,
  signal?: AbortSignal,
): Promise<{ ok: true; updatedAt: string }> {
  if (!isValidSyncCode(code)) {
    throw new CloudSyncError('Ungültiger Sync-Code.');
  }
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?code=${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    throw new CloudSyncError('Keine Verbindung zum Sync-Server.', e);
  }
  if (!response.ok) {
    throw new CloudSyncError(`Sync-Server antwortete mit ${response.status}.`);
  }
  return (await response.json()) as { ok: true; updatedAt: string };
}

/* ------------------------------------------------------------------ */
/* LocalConfig (pro PC) — Sync-Code, Aktivierungsstatus               */
/* ------------------------------------------------------------------ */

const LOCAL_CONFIG_KEY = 'daev.localConfig.v1';
const SYNC_META_KEY = 'daev.syncMeta.v1';

export function loadLocalConfig(): LocalConfig {
  if (typeof window === 'undefined') {
    return { syncEnabled: false, syncCode: null };
  }
  try {
    const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
    if (!raw) return { syncEnabled: false, syncCode: null };
    const parsed = JSON.parse(raw) as Partial<LocalConfig>;
    return {
      syncEnabled: !!parsed.syncEnabled,
      syncCode:
        typeof parsed.syncCode === 'string' && isValidSyncCode(parsed.syncCode)
          ? parsed.syncCode
          : null,
    };
  } catch {
    return { syncEnabled: false, syncCode: null };
  }
}

export function saveLocalConfig(config: LocalConfig): void {
  localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
}

/* ------------------------------------------------------------------ */
/* SyncMeta — persistente Cloud-Zeitstempel pro Gerät                 */
/* ------------------------------------------------------------------ */

export interface SyncMeta {
  /** Letzter bekannter Cloud-Stand-Zeitstempel (entweder gepusht oder geholt). */
  cloudTimestamp: string | null;
}

export function loadSyncMeta(): SyncMeta {
  if (typeof window === 'undefined') return { cloudTimestamp: null };
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return { cloudTimestamp: null };
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      cloudTimestamp:
        typeof parsed.cloudTimestamp === 'string' ? parsed.cloudTimestamp : null,
    };
  } catch {
    return { cloudTimestamp: null };
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

export function clearSyncMeta(): void {
  localStorage.removeItem(SYNC_META_KEY);
}
