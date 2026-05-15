import { useState } from 'react';
import { Cloud, CloudOff, Copy, Loader2, LogIn, RefreshCw, Sparkles, X } from 'lucide-react';
import { useStore, type SyncStatus } from '@/store';
import { normalizeSyncCode } from '@/lib/cloudSync';

interface Props {
  onClose: () => void;
}

export function SyncSection({ onClose }: Props) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [mode, setMode] = useState<'idle' | 'show-new' | 'join'>('idle');

  const cfg = store.localConfig;
  const isOn = cfg.syncEnabled && cfg.syncCode;

  async function handleNewCode() {
    setBusy(true);
    setError(null);
    try {
      const code = await store.enableSyncWithNewCode();
      setMode('show-new');
      // Code zum Kopieren bereitstellen
      try {
        await navigator.clipboard.writeText(code);
        setCopyConfirmed(true);
        setTimeout(() => setCopyConfirmed(false), 2500);
      } catch {
        // Clipboard kann in manchen Kontexten blockiert sein — egal, User sieht den Code
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    setError(null);
    try {
      const res = await store.joinSyncWithCode(joinInput);
      if (res.joined) {
        alert(`Synchronisation aktiviert. ${res.vehicleCount} Fahrzeug(e) übernommen.`);
        setJoinInput('');
        setMode('idle');
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!cfg.syncCode) return;
    void navigator.clipboard.writeText(cfg.syncCode).then(
      () => {
        setCopyConfirmed(true);
        setTimeout(() => setCopyConfirmed(false), 2500);
      },
      () => setError('Kopieren fehlgeschlagen — Code manuell markieren.'),
    );
  }

  return (
    <div className="border-t pt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Live-Sync zwischen PCs
        </div>
        <SyncStatusBadge status={store.syncStatus} />
      </div>

      {/* Aktiver Sync-Zustand */}
      {isOn && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 space-y-2">
          <div className="text-xs text-emerald-700">
            Sync ist aktiv. Auf weiteren Geräten unter „Vorhandenem Sync beitreten“ diesen Code eingeben:
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-base bg-white border border-emerald-300 rounded px-2 py-1 text-center tracking-wider select-all">
              {cfg.syncCode}
            </code>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopy}
              title="Code kopieren"
            >
              <Copy size={14} /> {copyConfirmed ? 'kopiert!' : 'kopieren'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost text-xs flex-1"
              onClick={() => void store.syncNow()}
            >
              <RefreshCw size={12} /> Jetzt syncen
            </button>
            <button
              type="button"
              className="btn-ghost text-xs text-red-600 hover:bg-red-50 flex-1"
              onClick={() => {
                if (window.confirm('Sync auf diesem PC ausschalten? Daten in der Cloud bleiben erhalten und können wieder verbunden werden.')) {
                  store.disableSync();
                  setMode('idle');
                }
              }}
            >
              <CloudOff size={12} /> Sync aus
            </button>
          </div>
          {store.syncError && (
            <p className="text-xs text-red-600">{store.syncError}</p>
          )}
        </div>
      )}

      {/* Sync NICHT aktiv: Aktionen anbieten */}
      {!isOn && mode === 'idle' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Verknüpft mehrere Geräte über einen privaten Sync-Code. Änderungen erscheinen
            binnen 10 Sekunden auf den anderen Geräten. Braucht Internet.
          </p>
          <p className="text-xs text-slate-500">
            <strong>Erstes Gerät:</strong> „Neuen Sync einrichten“ klicken — du bekommst einen Code.
            <br />
            <strong>Weitere Geräte:</strong> „Vorhandenem Sync beitreten“ klicken und den Code eintragen.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              className="btn-primary"
              onClick={handleNewCode}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Neuen Sync einrichten
            </button>
            <button
              className="btn-secondary"
              onClick={() => setMode('join')}
              disabled={busy}
            >
              <LogIn size={14} /> Vorhandenem Sync beitreten
            </button>
          </div>
        </div>
      )}

      {/* Code von anderem PC eintippen */}
      {!isOn && mode === 'join' && (
        <div className="space-y-2">
          <label className="label" htmlFor="join-code">
            Sync-Code des bereits eingerichteten Geräts eintragen
          </label>
          <input
            id="join-code"
            className="input font-mono text-center tracking-wider uppercase"
            placeholder="XXXX-XXXX-XXXX"
            value={joinInput}
            onChange={(e) => {
              const normalized = normalizeSyncCode(e.target.value);
              setJoinInput(normalized);
            }}
            maxLength={14}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              onClick={handleJoin}
              disabled={busy || joinInput.length < 14}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
              Verbinden
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setMode('idle');
                setJoinInput('');
                setError(null);
              }}
            >
              <X size={14} /> Abbrechen
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {error && mode !== 'join' && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const map: Record<SyncStatus, { label: string; class: string; icon: 'cloud' | 'cloudoff' | 'loader' }> =
    {
      off: { label: 'Aus', class: 'bg-slate-200 text-slate-600', icon: 'cloudoff' },
      idle: { label: 'Bereit', class: 'bg-slate-200 text-slate-700', icon: 'cloud' },
      syncing: { label: 'Synct…', class: 'bg-blue-100 text-blue-700', icon: 'loader' },
      online: { label: 'Online', class: 'bg-emerald-100 text-emerald-700', icon: 'cloud' },
      offline: { label: 'Offline', class: 'bg-amber-100 text-amber-800', icon: 'cloudoff' },
      error: { label: 'Fehler', class: 'bg-red-100 text-red-700', icon: 'cloudoff' },
    };
  const item = map[status];
  const Icon = item.icon === 'loader' ? Loader2 : item.icon === 'cloud' ? Cloud : CloudOff;
  return (
    <span className={`badge ${item.class} text-[10px]`}>
      <Icon size={11} className={item.icon === 'loader' ? 'animate-spin' : ''} />
      {item.label}
    </span>
  );
}
