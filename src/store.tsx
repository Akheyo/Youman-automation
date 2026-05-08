import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Vehicle, Settings } from '@/types';
import {
  exportBackup,
  generateId,
  importBackup as importBackupRaw,
  loadSettings,
  loadVehicles,
  saveSettings,
  saveVehicles,
  type Backup,
} from '@/lib/db';
import { createPoloSeed } from '@/lib/seed';

interface StoreContextValue {
  vehicles: Vehicle[];
  settings: Settings;
  addVehicle: (v: Omit<Vehicle, 'id' | 'erstelltAm' | 'geaendertAm'>) => Vehicle;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  duplicateVehicle: (id: string) => Vehicle | null;
  updateSettings: (patch: Partial<Settings>) => void;
  loadDemoData: () => void;
  resetAll: () => void;
  exportJson: () => Backup;
  importJson: (data: unknown) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => loadVehicles());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  // Auto-save bei jeder Änderung
  useEffect(() => {
    saveVehicles(vehicles);
  }, [vehicles]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

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

  const exportJson = useCallback(() => exportBackup(), []);

  const importJson = useCallback<StoreContextValue['importJson']>((data) => {
    const result = importBackupRaw(data);
    setVehicles(result.vehicles);
    setSettings(result.settings);
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      vehicles,
      settings,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      duplicateVehicle,
      updateSettings,
      loadDemoData,
      resetAll,
      exportJson,
      importJson,
    }),
    [
      vehicles,
      settings,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      duplicateVehicle,
      updateSettings,
      loadDemoData,
      resetAll,
      exportJson,
      importJson,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
