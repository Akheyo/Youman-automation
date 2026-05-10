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
import type { Vehicle, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { generateId, getStorageLocationLabel, isTauri, loadAll, saveAll } from '@/lib/storage';
import { createPoloSeed } from '@/lib/seed';

interface StoreContextValue {
  vehicles: Vehicle[];
  settings: Settings;
  /** Letzter erfolgreicher Lade-/Speicher-Zeitpunkt (für UI-Anzeige). */
  lastSyncedAt: string | null;
  /** Pfad/Beschreibung des Speicherorts (Tauri-Modus: Dateipfad, Web: Hinweis). */
  storageLocation: string;
  /** Wahr, solange der Initial-Load noch läuft. */
  loading: boolean;
  addVehicle: (v: Omit<Vehicle, 'id' | 'erstelltAm' | 'geaendertAm'>) => Vehicle;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  duplicateVehicle: (id: string) => Vehicle | null;
  updateSettings: (patch: Partial<Settings>) => void;
  loadDemoData: () => void;
  resetAll: () => void;
  /** Manuelles Neu-Lesen der Datei — für Sync-Knopf. */
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [storageLocation, setStorageLocation] = useState<string>('Lade…');

  // Tracks ob wir gerade einen externen Load durchführen — damit der Save-Effect
  // nicht direkt nach einem Reload die frisch geladenen Daten zurückschreibt.
  const skipNextSaveRef = useRef<boolean>(true);
  const initialLoadDoneRef = useRef<boolean>(false);

  // Initial-Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadAll();
      if (cancelled) return;
      setVehicles(result.vehicles);
      setSettings(result.settings);
      setLastSyncedAt(result.fileTimestamp ?? null);
      setStorageLocation(await getStorageLocationLabel());
      setLoading(false);
      // Skip-Flag erst nach dem ersten render-Tick zurücksetzen
      requestAnimationFrame(() => {
        skipNextSaveRef.current = false;
        initialLoadDoneRef.current = true;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save (debounced) bei jeder Änderung
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
    }, 250);
    return () => clearTimeout(handle);
  }, [vehicles, settings]);

  const refresh = useCallback(async () => {
    const result = await loadAll();
    skipNextSaveRef.current = true; // verhindert, dass wir die geladenen Daten direkt zurückschreiben
    setVehicles(result.vehicles);
    setSettings(result.settings);
    setLastSyncedAt(result.fileTimestamp ?? null);
  }, []);

  // Bei Window-Focus: Datei neu lesen — so kommen Änderungen vom anderen PC an
  useEffect(() => {
    if (!isTauri()) return;
    function handleFocus() {
      void refresh();
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

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

  const value = useMemo<StoreContextValue>(
    () => ({
      vehicles,
      settings,
      lastSyncedAt,
      storageLocation,
      loading,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      duplicateVehicle,
      updateSettings,
      loadDemoData,
      resetAll,
      refresh,
    }),
    [
      vehicles,
      settings,
      lastSyncedAt,
      storageLocation,
      loading,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      duplicateVehicle,
      updateSettings,
      loadDemoData,
      resetAll,
      refresh,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
