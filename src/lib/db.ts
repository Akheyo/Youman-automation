import type { Vehicle, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

const VEHICLES_KEY = 'youman.vehicles.v1';
const SETTINGS_KEY = 'youman.settings.v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadVehicles(): Vehicle[] {
  if (typeof window === 'undefined') return [];
  return safeParse<Vehicle[]>(localStorage.getItem(VEHICLES_KEY), []);
}

export function saveVehicles(vehicles: Vehicle[]): void {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const stored = safeParse<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY), {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Komplettes Backup als JSON-Objekt. */
export interface Backup {
  version: 1;
  exportedAt: string;
  settings: Settings;
  vehicles: Vehicle[];
}

export function exportBackup(): Backup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    vehicles: loadVehicles(),
  };
}

export function importBackup(data: unknown): { vehicles: Vehicle[]; settings: Settings } {
  if (!data || typeof data !== 'object') {
    throw new Error('Backup-Datei ist nicht im erwarteten Format.');
  }
  const obj = data as Partial<Backup>;
  if (!Array.isArray(obj.vehicles)) {
    throw new Error('Backup enthält keine Fahrzeug-Liste.');
  }
  const vehicles = obj.vehicles as Vehicle[];
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(obj.settings ?? {}) };
  saveVehicles(vehicles);
  saveSettings(settings);
  return { vehicles, settings };
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
