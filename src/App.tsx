import { useEffect, useState } from 'react';
import { useStore } from './store';
import { VehicleList } from './components/VehicleList';
import { VehicleDetail } from './components/VehicleDetail';
import { VehicleForm } from './components/VehicleForm';
import { VerkaufModal } from './components/VerkaufModal';
import { Dialog } from './components/Dialog';
import { Car, Download, Plus, RefreshCw, Settings as SettingsIcon, Upload } from 'lucide-react';
import { isTauri } from './lib/storage';
import { formatDatum } from './lib/format';
import type { Vehicle } from './types';

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'detail'; id: string };

export default function App() {
  const store = useStore();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [verkaufVehicleId, setVerkaufVehicleId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Beim ersten Start: Demo-Datensatz anbieten, wenn nichts da ist
  useEffect(() => {
    if (store.vehicles.length === 0) {
      const seen = localStorage.getItem('daev.demoOffered');
      if (!seen) {
        localStorage.setItem('daev.demoOffered', '1');
        if (
          window.confirm(
            'Willkommen beim DAEV Margin Tool!\n\n' +
              'Soll der Beispiel-Datensatz "VW Polo" geladen werden?\n' +
              '(zeigt 1.533 € Gewinnanteil bei 32,27 % Marge)',
          )
        ) {
          store.loadDemoData();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aktuellesFahrzeug: Vehicle | undefined =
    view.kind === 'detail' || view.kind === 'edit'
      ? store.vehicles.find((v) => v.id === view.id)
      : undefined;
  const verkaufVehicle = verkaufVehicleId
    ? store.vehicles.find((v) => v.id === verkaufVehicleId)
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            className="flex items-center gap-2 hover:opacity-90"
            onClick={() => setView({ kind: 'list' })}
          >
            <Car size={22} />
            <span className="font-bold text-lg tracking-wide">DAEV Margin Tool</span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              · Differenzbesteuerung §25a UStG
            </span>
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {view.kind === 'list' && (
              <button className="btn-success" onClick={() => setView({ kind: 'create' })}>
                <Plus size={16} /> Neues Fahrzeug
              </button>
            )}
            {isTauri() && (
              <button
                className="btn-ghost text-white hover:bg-white/10"
                onClick={() => void store.refresh()}
                title="Daten neu laden (z.B. nach Änderung am anderen PC)"
                aria-label="Synchronisieren"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button
              className="btn-ghost text-white hover:bg-white/10"
              onClick={() => setSettingsOpen(true)}
              title="Einstellungen"
              aria-label="Einstellungen"
            >
              <SettingsIcon size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {view.kind === 'list' && (
          <VehicleList
            vehicles={store.vehicles}
            onSelect={(id) => setView({ kind: 'detail', id })}
          />
        )}

        {view.kind === 'create' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Neues Fahrzeug</h1>
            <VehicleForm
              defaultStundensatz={store.settings.defaultStundensatz}
              onSubmit={(data) => {
                const v = store.addVehicle(data);
                setView({ kind: 'detail', id: v.id });
              }}
              onCancel={() => setView({ kind: 'list' })}
            />
          </div>
        )}

        {view.kind === 'edit' && aktuellesFahrzeug && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">
              Bearbeiten: {aktuellesFahrzeug.marke} {aktuellesFahrzeug.modell}
            </h1>
            <VehicleForm
              initial={aktuellesFahrzeug}
              defaultStundensatz={store.settings.defaultStundensatz}
              onSubmit={(data) => {
                store.updateVehicle(aktuellesFahrzeug.id, data);
                setView({ kind: 'detail', id: aktuellesFahrzeug.id });
              }}
              onCancel={() => setView({ kind: 'detail', id: aktuellesFahrzeug.id })}
            />
          </div>
        )}

        {view.kind === 'detail' && aktuellesFahrzeug && (
          <VehicleDetail
            vehicle={aktuellesFahrzeug}
            onBack={() => setView({ kind: 'list' })}
            onEdit={() => setView({ kind: 'edit', id: aktuellesFahrzeug.id })}
            onSell={() => setVerkaufVehicleId(aktuellesFahrzeug.id)}
            onDuplicate={() => {
              const copy = store.duplicateVehicle(aktuellesFahrzeug.id);
              if (copy) setView({ kind: 'edit', id: copy.id });
            }}
            onDelete={() => {
              if (
                window.confirm(
                  `Fahrzeug "${aktuellesFahrzeug.marke} ${aktuellesFahrzeug.modell}" wirklich löschen?`,
                )
              ) {
                store.deleteVehicle(aktuellesFahrzeug.id);
                setView({ kind: 'list' });
              }
            }}
          />
        )}

        {view.kind === 'detail' && !aktuellesFahrzeug && (
          <div className="card p-8 text-center text-slate-500">
            Fahrzeug nicht gefunden.{' '}
            <button className="text-slate-900 underline" onClick={() => setView({ kind: 'list' })}>
              Zur Übersicht
            </button>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-4">
        DAEV Margin Tool · Berechnung gem. §25a UStG · Daten werden lokal im Browser gespeichert
      </footer>

      {verkaufVehicle && (
        <VerkaufModal
          vehicle={verkaufVehicle}
          open={true}
          onClose={() => setVerkaufVehicleId(null)}
          onConfirm={(patch) => {
            store.updateVehicle(verkaufVehicle.id, patch);
            setVerkaufVehicleId(null);
          }}
        />
      )}

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Einstellungen"
        width="sm"
        footer={
          <button className="btn-primary" onClick={() => setSettingsOpen(false)}>
            Schließen
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="default-stundensatz">
              Standard-Stundensatz
            </label>
            <div className="relative">
              <input
                id="default-stundensatz"
                type="number"
                className="input pr-12"
                value={store.settings.defaultStundensatz}
                min={0}
                step={1}
                onChange={(e) =>
                  store.updateSettings({
                    defaultStundensatz: Number(e.target.value) || 0,
                  })
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">€/h</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Wird beim Anlegen neuer Fahrzeuge übernommen.
            </p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Speicherort
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-xs font-mono break-all text-slate-700">
              {store.storageLocation}
            </div>
            {isTauri() ? (
              <p className="text-xs text-slate-500">
                Wenn dieser Ordner via OneDrive synchronisiert wird (Standard auf Windows 11
                mit Microsoft-Konto), arbeiten beide PCs automatisch auf demselben Datenbestand.
                Beim Wechsel auf den anderen PC einmal auf <RefreshCw size={11} className="inline -mt-0.5" /> klicken,
                falls die App schon geöffnet war.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Web-Vorschau: Daten liegen nur im Browser dieses Geräts. Der Auto-Sync zwischen
                zwei PCs funktioniert nur in der installierten Desktop-Version.
              </p>
            )}
            {store.lastSyncedAt && (
              <p className="text-xs text-slate-400">
                Zuletzt gespeichert: {formatDatum(store.lastSyncedAt)} ·{' '}
                {new Date(store.lastSyncedAt).toLocaleTimeString('de-DE')}
              </p>
            )}
            {isTauri() && (
              <button
                className="btn-secondary w-full"
                onClick={() => void store.refresh()}
              >
                <RefreshCw size={14} /> Jetzt vom Speicherort neu laden
              </button>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Daten zwischen PCs übertragen
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Auf PC 1 <b>Exportieren</b> klicken → Datei per Mail/USB an PC 2 senden → dort
              <b> Importieren</b> klicken. Importieren ersetzt alle aktuellen Daten auf diesem PC.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const result = await store.exportBackup();
                    if (result.saved) {
                      alert(
                        result.path
                          ? `Gespeichert unter:\n${result.path}`
                          : 'Datei wurde heruntergeladen.',
                      );
                    }
                  } catch (e) {
                    alert(`Export fehlgeschlagen: ${(e as Error).message}`);
                  }
                }}
              >
                <Download size={14} /> Exportieren
              </button>
              <button
                className="btn-secondary"
                onClick={async () => {
                  if (
                    store.vehicles.length > 0 &&
                    !window.confirm(
                      'Importieren ersetzt alle aktuellen Fahrzeugdaten auf diesem PC. Fortfahren?',
                    )
                  )
                    return;
                  try {
                    const result = await store.importBackup();
                    if (result) {
                      alert(
                        `Import erfolgreich: ${result.vehicles.length} Fahrzeug(e) übernommen.`,
                      );
                      setSettingsOpen(false);
                    }
                  } catch (e) {
                    alert(`Import fehlgeschlagen: ${(e as Error).message}`);
                  }
                }}
              >
                <Upload size={14} /> Importieren
              </button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <button
              className="btn-secondary w-full"
              onClick={() => {
                store.loadDemoData();
                setSettingsOpen(false);
              }}
            >
              Beispiel "VW Polo" laden
            </button>
            <button
              className="btn-danger w-full"
              onClick={() => {
                if (
                  window.confirm(
                    'Wirklich ALLE Fahrzeuge löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
                  )
                ) {
                  store.resetAll();
                  setSettingsOpen(false);
                }
              }}
            >
              Alle Fahrzeugdaten löschen
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
