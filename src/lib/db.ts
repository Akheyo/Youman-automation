import type { Vehicle, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

const VEHICLES_KEY = 'daev.vehicles.v1';
const SETTINGS_KEY = 'daev.settings.v1';

// Migrations-Schlüssel aus der ursprünglichen Version
const LEGACY_VEHICLES_KEY = 'youman.vehicles.v1';
const LEGACY_SETTINGS_KEY = 'youman.settings.v1';

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

export function loadVehicles(): Vehicle[] {
  if (typeof window === 'undefined') return [];
  migrateLegacy(VEHICLES_KEY, LEGACY_VEHICLES_KEY);
  return safeParse<Vehicle[]>(localStorage.getItem(VEHICLES_KEY), []);
}

export function saveVehicles(vehicles: Vehicle[]): void {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  migrateLegacy(SETTINGS_KEY, LEGACY_SETTINGS_KEY);
  const stored = safeParse<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY), {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
