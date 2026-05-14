import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Vehicle, Settings, LocalConfig } from '@/types';
import { DEFAULT_SETTINGS, DEFAULT_LOCAL_CONFIG } from '@/types';
import {
  generateId,
  getStorageLocationLabel,
  isTauri,
  loadAll,
  saveAll,
  exportToFile,
  importFromFile,
  type BackupBlob,
} from '@/lib/storage';
import {
  CloudSyncError,
  generateSyncCode,
  isValidSyncCode,
  loadLocalConfig,
  normalizeSyncCode,
  pullFromCloud,
  pushToCloud,
  saveLocalConfig,
} from '@/lib/cloudSync';
import { createPoloSeed } from '@/lib/seed';

export type SyncStatus =
  | 'off'
  | 'idle'
  | 'syncing'
  | 'online'
  | 'offline'
  | 'error';

interface StoreContextValue {
  vehicles: Vehicle[];
  settings: Settings;
  /** Letzter erfolgreicher Lade-/Speicher-Zeitpunkt (für UI-Anzeige). */
  lastSyncedAt: string | null;
  /** Pfad/Beschreibung des Speicherorts (Tauri-Modus: Dateipfad, Web: Hinweis). */
  storageLocation: string;
  /** Wahr, solange der Initial-Load noch läuft. */
  loading: boolean;
  /** Cloud-Sync-Status für UI-Anzeige. */
  syncStatus: SyncStatus;
  /** Letzter Cloud-Sync-Fehler. */
  syncError: string | null;
  /** Aktive Sync-Konfiguration auf diesem Gerät. */
  localConfig: LocalConfig;
  addVehicle: (v: Omit<Vehicle, 'id' | 'erstelltAm' | 'geaendertAm'>) => Vehicle;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  duplicateVehicle: (id: string) => Vehicle | null;
  updateSettings: (patch: Partial<Settings>) => void;
  loadDemoData: () => void;
  resetAll: () => void;
  refresh: () => Promise<void>;
  exportBackup: () => Promise<{ saved: boolean; path: string | null }>;
  importBackup: () => Promise<BackupBlob | null>;
  /** Aktiviert Cloud-Sync und generiert einen neuen Sync-Code. Lädt aktuelle Daten in die Cloud. */
  enableSyncWithNewCode: () => Promise<string>;
  /** Aktiviert Cloud-Sync mit einem bereits existierenden Code (z.B. vom anderen PC). Holt Daten aus der Cloud. */
  joinSyncWithCode: (code: string) => Promise<{ joined: boolean; vehicleCount: number }>;
  /** Deaktiviert Cloud-Sync. Lokale Daten bleiben unangetastet. */
  disableSync: () => void;
  /** Manueller Pull/Push gegen die Cloud. */
  syncNow: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const POLL_INTERVAL_MS = 10_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [storageLocation, setStorageLocation] = useState<string>('Lade…');
  const [localConfig, setLocalConfig] = useState<LocalConfig>(DEFAULT_LOCAL_CONFIG);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cloudTimestamp, setCloudTimestamp] = useState<string | null>(null);

  // Refs zur Vermeidung von Race-Conditions
  const skipNextSaveRef = useRef<boolean>(true);
  const initialLoadDoneRef = useRef<boolean>(false);
  const cloudTimestampRef = useRef<string | null>(null);
  const localConfigRef = useRef<LocalConfig>(DEFAULT_LOCAL_CONFIG);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    cloudTimestampRef.current = cloudTimestamp;
  }, [cloudTimestamp]);
  useEffect(() => {
    localConfigRef.current = localConfig;
  }, [localConfig]);
  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  /* ---------- Initial-Load ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fileResult = await loadAll();
      const cfg = loadLocalConfig();
      if (cancelled) return;
      setVehicles(fileResult.vehicles);
      setSettings(fileResult.settings);
      setLastSyncedAt(fileResult.fileTimestamp ?? null);
      setStorageLocation(await getStorageLocationLabel());
      setLocalConfig(cfg);
      setSyncStatus(cfg.syncEnabled && cfg.syncCode ? 'idle' : 'off');
      setLoading(false);
      requestAnimationFrame(() => {
        skipNextSaveRef.current = false;
        initialLoadDoneRef.current = true;
      });

      // Wenn Sync schon aktiv: gleich einen Pull versuchen
      if (cfg.syncEnabled && cfg.syncCode) {
        void cloudPull(cfg.syncCode);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Auto-save (lokal + cloud) ---------- */
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const handle = setTimeout(() => {
      void saveAll(vehicles, settings).then((res) => {
        setLastSyncedAt(res.timestamp);
      });
      const cfg = localConfigRef.current;
      if (cfg.syncEnabled && cfg.syncCode) {
        void cloudPush(cfg.syncCode);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [vehicles, settings]);

  /* ---------- Cloud Pull & Push ---------- */

  const cloudPull = useCallback(async (code: string) => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const entry = await pullFromCloud(code);
      if (entry.exists && entry.payload && entry.updatedAt) {
        // Nur übernehmen, wenn der Cloud-Stand neuer ist als unser zuletzt gesehener
        if (
          !cloudTimestampRef.current ||
          new Date(entry.updatedAt) > new Date(cloudTimestampRef.current)
        ) {
          skipNextSaveRef.current = true; // verhindert direktes Zurückschreiben
          setVehicles(entry.payload.vehicles);
          setSettings(entry.payload.settings);
          setCloudTimestamp(entry.updatedAt);
          setLastSyncedAt(entry.updatedAt);
        }
      }
      setSyncStatus('online');
    } catch (e) {
      const msg = e instanceof CloudSyncError ? e.message : 'Sync fehlgeschlagen.';
      setSyncError(msg);
      setSyncStatus('offline');
    }
  }, []);

  const cloudPush = useCallback(async (code: string) => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const result = await pushToCloud(code, {
        vehicles: vehiclesRef.current,
        settings: settingsRef.current,
      });
      setCloudTimestamp(result.updatedAt);
      setLastSyncedAt(result.updatedAt);
      setSyncStatus('online');
    } catch (e) {
      const msg = e instanceof CloudSyncError ? e.message : 'Sync fehlgeschlagen.';
      setSyncError(msg);
      setSyncStatus('offline');
    }
  }, []);

  /* ---------- Polling während Sync aktiv ---------- */
  useEffect(() => {
    if (!localConfig.syncEnabled || !localConfig.syncCode) return;
    const interval = setInterval(() => {
      void cloudPull(localConfig.syncCode!);
    }, POLL_INTERVAL_MS);
    // sofort einen pull machen
    void cloudPull(localConfig.syncCode);
    return () => clearInterval(interval);
  }, [localConfig.syncEnabled, localConfig.syncCode, cloudPull]);

  /* ---------- Pull bei Window-Focus ---------- */
  useEffect(() => {
    function handleFocus() {
      const cfg = localConfigRef.current;
      if (cfg.syncEnabled && cfg.syncCode) void cloudPull(cfg.syncCode);
      else if (isTauri()) void refresh();
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    const result = await loadAll();
    skipNextSaveRef.current = true;
    setVehicles(result.vehicles);
    setSettings(result.settings);
    setLastSyncedAt(result.fileTimestamp ?? null);
  }, []);

  /* ---------- Sync-Lifecycle ---------- */

  const updateLocalConfig = useCallback((patch: Partial<LocalConfig>) => {
    setLocalConfig((prev) => {
      const next = { ...prev, ...patch };
      saveLocalConfig(next);
      return next;
    });
  }, []);

  const enableSyncWithNewCode = useCallback(async () => {
    const code = generateSyncCode();
    updateLocalConfig({ syncEnabled: true, syncCode: code });
    // Sofort die aktuellen Daten in die Cloud schieben, damit der zweite PC sie findet
    await cloudPush(code);
    return code;
  }, [cloudPush, updateLocalConfig]);

  const joinSyncWithCode = useCallback<StoreContextValue['joinSyncWithCode']>(
    async (raw: string) => {
      const code = normalizeSyncCode(raw);
      if (!isValidSyncCode(code)) {
        throw new Error('Ungültiger Sync-Code. Format: XXXX-XXXX-XXXX');
      }
      const entry = await pullFromCloud(code);
      if (!entry.exists || !entry.payload || !entry.updatedAt) {
        throw new Error('Zu diesem Sync-Code wurden keine Daten gefunden.');
      }
      skipNextSaveRef.current = true;
      setVehicles(entry.payload.vehicles);
      setSettings(entry.payload.settings);
      setCloudTimestamp(entry.updatedAt);
      setLastSyncedAt(entry.updatedAt);
      updateLocalConfig({ syncEnabled: true, syncCode: code });
      setSyncStatus('online');
      return { joined: true, vehicleCount: entry.payload.vehicles.length };
    },
    [updateLocalConfig],
  );

  const disableSync = useCallback(() => {
    updateLocalConfig({ syncEnabled: false, syncCode: null });
    setSyncStatus('off');
    setCloudTimestamp(null);
  }, [updateLocalConfig]);

  const syncNow = useCallback(async () => {
    const cfg = localConfigRef.current;
    if (!cfg.syncEnabled || !cfg.syncCode) return;
    await cloudPush(cfg.syncCode);
    await cloudPull(cfg.syncCode);
  }, [cloudPush, cloudPull]);

  /* ---------- CRUD ---------- */

  const addVehicle = useCallback<StoreContextValue['addVehicle']>((data) => {
    const now = new Date().toISOString();
    const vehicle: Vehicle = {
      ...data,
      id: generateId(),
      erstelltAm: now,
      geaendertAm: now,
    };
    setVehicles((prev) => [vehicle, ...prev]);
    return vehicle;
  }, []);

  const updateVehicle = useCallback<StoreContextValue['updateVehicle']>((id, patch) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch, geaendertAm: new Date().toISOString() } : v)),
    );
  }, []);

  const deleteVehicle = useCallback<StoreContextValue['deleteVehicle']>((id) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const duplicateVehicle = useCallback<StoreContextValue['duplicateVehicle']>(
    (id) => {
      const original = vehicles.find((v) => v.id === id);
      if (!original) return null;
      const now = new Date().toISOString();
      const copy: Vehicle = {
        ...original,
        id: generateId(),
        modell: `${original.modell} (Kopie)`,
        verkaufsdatum: undefined,
        verkaufspreis: undefined,
        kaeufer: undefined,
        status: 'im_bestand',
        erstelltAm: now,
        geaendertAm: now,
      };
      setVehicles((prev) => [copy, ...prev]);
      return copy;
    },
    [vehicles],
  );

  const updateSettings = useCallback<StoreContextValue['updateSettings']>((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadDemoData = useCallback(() => {
    const polo = createPoloSeed();
    setVehicles((prev) => {
      if (prev.some((v) => v.id === polo.id)) return prev;
      return [polo, ...prev];
    });
  }, []);

  const resetAll = useCallback(() => {
    setVehicles([]);
  }, []);

  const exportBackup = useCallback(() => exportToFile(vehicles, settings), [vehicles, settings]);

  const importBackup = useCallback<StoreContextValue['importBackup']>(async () => {
    const blob = await importFromFile();
    if (!blob) return null;
    skipNextSaveRef.current = false;
    setVehicles(blob.vehicles);
    setSettings(blob.settings);
    return blob;
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      vehicles,
      settings,
      lastSyncedAt,
      storageLocation,
      loading,
      syncStatus,
      syncError,
      localConfig,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      duplicateVehicle,
      updateSettings,
      loadDemoData,
      resetAll,
      refresh,
      exportBackup,
      importBackup,
      enableSyncWithNewCode,
      joinSyncWithCode,
      disableSync,
      syncNow,
    }),
    [
      vehicles,
      settings,
      lastSyncedAt,
      storageLocation,
      loading,
      syncStatus,
      syncError,
      localConfig,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      duplicateVehicle,
      updateSettings,
      loadDemoData,
      resetAll,
      refresh,
      exportBackup,
      importBackup,
      enableSyncWithNewCode,
      joinSyncWithCode,
      disableSync,
      syncNow,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
