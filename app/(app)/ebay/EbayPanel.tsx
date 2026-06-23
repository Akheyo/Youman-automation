'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import s from '../dashboard/dashboard.module.css';
import f from './ebay.module.css';

interface EbayConfig {
  enabled: boolean;
  sheet_csv_url: string;
  marketplace_id: string;
  currency: string;
  default_category_id: string;
  default_condition: string;
  fulfillment_policy_id: string;
  payment_policy_id: string;
  return_policy_id: string;
  merchant_location_key: string;
  auto_publish: boolean;
}

interface Listing {
  sku: string;
  title: string | null;
  price: number | null;
  status: string;
  listing_id: string | null;
  error: string | null;
  updated_at: string;
}

interface SyncResult {
  ok: boolean;
  reason?: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
  errors: { sku: string; message: string }[];
}

const DEFAULTS: EbayConfig = {
  enabled: false,
  sheet_csv_url: '',
  marketplace_id: 'EBAY_DE',
  currency: 'EUR',
  default_category_id: '',
  default_condition: 'NEW',
  fulfillment_policy_id: '',
  payment_policy_id: '',
  return_policy_id: '',
  merchant_location_key: '',
  auto_publish: true,
};

const MARKETPLACES = ['EBAY_DE', 'EBAY_AT', 'EBAY_CH', 'EBAY_US', 'EBAY_GB', 'EBAY_FR', 'EBAY_IT', 'EBAY_ES'];
const CONDITIONS = ['NEW', 'LIKE_NEW', 'USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE', 'CERTIFIED_REFURBISHED', 'SELLER_REFURBISHED'];

const CALLBACK_MSG: Record<string, { kind: 'ok' | 'warn' | 'err'; text: string }> = {
  connected: { kind: 'ok', text: '✓ eBay-Konto verbunden. Du kannst jetzt synchronisieren.' },
  denied: { kind: 'warn', text: 'Verbindung abgebrochen — du hast die eBay-Freigabe nicht erteilt.' },
  noretoken: { kind: 'warn', text: 'eBay hat keinen Refresh-Token geliefert. Bitte erneut verbinden.' },
  unconfigured: { kind: 'err', text: 'eBay-App-Zugang fehlt (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET / EBAY_RU_NAME in den Env-Variablen setzen).' },
  error: { kind: 'err', text: 'Bei der eBay-Verbindung ist ein Fehler aufgetreten. Bitte erneut versuchen.' },
};

export default function EbayPanel({
  initialConfig,
  connected,
  connection,
  initialListings,
  appConfigured,
  environment,
}: {
  initialConfig: Partial<EbayConfig> | null;
  connected: boolean;
  connection: { connected_at?: string; environment?: string } | null;
  initialListings: Listing[];
  appConfigured: boolean;
  environment: string;
}) {
  const params = useSearchParams();
  const [config, setConfig] = useState<EbayConfig>({ ...DEFAULTS, ...(initialConfig ?? {}) });
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runResult, setRunResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callbackKey = params.get('ebay');
  const callbackMsg = callbackKey ? CALLBACK_MSG[callbackKey] : null;

  const stats = useMemo(() => {
    const listed = listings.filter((l) => l.status === 'listed').length;
    const pending = listings.filter((l) => l.status === 'pending').length;
    const failed = listings.filter((l) => l.status === 'error').length;
    return { listed, pending, failed, total: listings.length };
  }, [listings]);

  // Keep saved-confirmation transient.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  function set<K extends keyof EbayConfig>(key: K, value: EbayConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ebay/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      // Persist the current form first so the sync uses fresh settings.
      await save();
      const res = await fetch('/api/ebay/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync fehlgeschlagen.');
      setRunResult(data.result as SyncResult);
      // Refresh the listing table.
      const refreshed = await fetch('/api/ebay/listings').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (refreshed?.listings) setListings(refreshed.listings);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={s.page}>
      <main className={s.main}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.title}>eBay-Listings</h1>
            <p className={s.hello}>Produkte aus deiner Google-Sheet automatisch bei eBay einstellen</p>
          </div>
          <button className={s.primaryAction} onClick={runNow} disabled={running || !connected}>
            {running ? 'Läuft …' : 'Jetzt synchronisieren'}
          </button>
        </div>

        {callbackMsg && (
          <div className={`${f.note} ${callbackMsg.kind === 'ok' ? f.noteOk : callbackMsg.kind === 'warn' ? f.noteWarn : f.noteErr}`}>
            {callbackMsg.text}
          </div>
        )}
        {error && <div className={`${f.note} ${f.noteErr}`}>{error}</div>}
        {!appConfigured && (
          <div className={`${f.note} ${f.noteWarn}`}>
            eBay-App-Zugang noch nicht in den Env-Variablen hinterlegt (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RU_NAME).
            Ohne diese kann keine Verbindung hergestellt werden.
          </div>
        )}

        {/* Connection */}
        <section className={s.card}>
          <div className={s.sectionTitle}>1 · eBay-Konto verbinden</div>
          <div className={s.settingRow}>
            <div>
              <div className={s.settingName}>Status</div>
              <div className={s.settingDesc}>
                {connected
                  ? `Verbunden${connection?.connected_at ? ` seit ${new Date(connection.connected_at).toLocaleDateString('de-DE')}` : ''} · Umgebung: ${connection?.environment ?? environment}`
                  : 'Noch nicht verbunden — ohne Verbindung kann nichts eingestellt werden.'}
              </div>
            </div>
            {connected ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={s.okPill}>✓ Verbunden</span>
                <a href="/api/ebay/connect" className={f.ghostBtn}>Neu verbinden</a>
              </div>
            ) : (
              <a href="/api/ebay/connect" className={s.settingBtn} aria-disabled={!appConfigured}>
                Mit eBay verbinden
              </a>
            )}
          </div>
        </section>

        {/* Source + settings */}
        <section className={s.card}>
          <div className={s.sectionTitle}>2 · Quelle &amp; Einstellungen</div>

          <div className={f.grid}>
            <div className={`${f.field} ${f.fieldWide}`}>
              <label className={f.lbl}>Google-Sheet / CSV-URL</label>
              <input
                className={f.input}
                placeholder="https://docs.google.com/…/pub?output=csv"
                value={config.sheet_csv_url}
                onChange={(e) => set('sheet_csv_url', e.target.value)}
              />
              <span className={f.hint}>
                In Google Sheets: Datei → Freigeben → Im Web veröffentlichen → Format CSV → Link hier einfügen.
                Spalten (DE/EN erkannt): sku, titel, preis, menge, beschreibung, zustand, kategorie, marke, ean, bilder, merkmale.
              </span>
            </div>

            <div className={f.field}>
              <label className={f.lbl}>Marktplatz</label>
              <select className={f.select} value={config.marketplace_id} onChange={(e) => set('marketplace_id', e.target.value)}>
                {MARKETPLACES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.lbl}>Währung</label>
              <input className={f.input} value={config.currency} onChange={(e) => set('currency', e.target.value)} />
            </div>
            <div className={f.field}>
              <label className={f.lbl}>Standard-Zustand</label>
              <select className={f.select} value={config.default_condition} onChange={(e) => set('default_condition', e.target.value)}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className={f.field}>
              <label className={f.lbl}>Standard-Kategorie-ID</label>
              <input className={f.input} placeholder="z. B. 9355" value={config.default_category_id} onChange={(e) => set('default_category_id', e.target.value)} />
              <span className={f.hint}>Fallback, wenn die Zeile keine Kategorie nennt.</span>
            </div>

            <div className={f.field}>
              <label className={f.lbl}>Versand-Policy-ID</label>
              <input className={f.input} value={config.fulfillment_policy_id} onChange={(e) => set('fulfillment_policy_id', e.target.value)} />
            </div>
            <div className={f.field}>
              <label className={f.lbl}>Zahlungs-Policy-ID</label>
              <input className={f.input} value={config.payment_policy_id} onChange={(e) => set('payment_policy_id', e.target.value)} />
            </div>
            <div className={f.field}>
              <label className={f.lbl}>Rücknahme-Policy-ID</label>
              <input className={f.input} value={config.return_policy_id} onChange={(e) => set('return_policy_id', e.target.value)} />
            </div>
            <div className={f.field}>
              <label className={f.lbl}>Standort-Key (Lager)</label>
              <input className={f.input} value={config.merchant_location_key} onChange={(e) => set('merchant_location_key', e.target.value)} />
              <span className={f.hint}>merchantLocationKey aus deinem eBay-Verkäuferkonto.</span>
            </div>
          </div>

          <div className={f.toggleRow}>
            <input type="checkbox" id="autopub" checked={config.auto_publish} onChange={(e) => set('auto_publish', e.target.checked)} />
            <label htmlFor="autopub">
              <span className={s.settingName}>Direkt veröffentlichen</span>
              <span className={s.settingDesc} style={{ display: 'block' }}>Listings sofort live stellen (statt nur als Entwurf/Angebot anzulegen).</span>
            </label>
          </div>
          <div className={f.toggleRow}>
            <input type="checkbox" id="enabled" checked={config.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            <label htmlFor="enabled">
              <span className={s.settingName}>Auto-Sync aktiv</span>
              <span className={s.settingDesc} style={{ display: 'block' }}>Der Cron-Job stellt neue/geänderte Zeilen automatisch ein (vollautomatisch).</span>
            </label>
          </div>

          <div className={f.actions}>
            <button className={f.saveBtn} onClick={save} disabled={saving}>
              {saving ? 'Speichert …' : saved ? '✓ Gespeichert' : 'Einstellungen speichern'}
            </button>
            <button className={f.ghostBtn} onClick={runNow} disabled={running || !connected}>
              {running ? 'Synchronisiert …' : 'Speichern & jetzt synchronisieren'}
            </button>
          </div>
        </section>

        {/* Run result */}
        {runResult && (
          <section className={s.card}>
            <div className={s.sectionTitle}>Letzter Lauf</div>
            {runResult.reason ? (
              <div className={`${f.note} ${f.noteWarn}`}>{runResult.reason}</div>
            ) : (
              <div className={s.statRow}>
                <Stat value={runResult.created} label="Neu eingestellt" />
                <Stat value={runResult.updated} label="Aktualisiert" />
                <Stat value={runResult.skipped} label="Übersprungen" />
                <Stat value={runResult.failed} label="Fehlgeschlagen" accent={runResult.failed > 0} />
              </div>
            )}
            {runResult.errors.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {runResult.errors.slice(0, 10).map((e) => (
                  <div key={e.sku} className={f.note + ' ' + f.noteErr} style={{ marginBottom: 8 }}>
                    <strong>{e.sku}:</strong> {e.message}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Listings */}
        <section className={s.card}>
          <div className={s.sectionTitle}>
            Listings
            <span className={s.sectionLink}>
              {stats.listed} live · {stats.pending} offen · {stats.failed} Fehler
            </span>
          </div>
          {listings.length === 0 ? (
            <p className={s.empty}>Noch keine Listings. Verbinde dein eBay-Konto, hinterlege die Sheet-URL und klicke auf {'„Jetzt synchronisieren"'}.</p>
          ) : (
            <div className={s.leadTable}>
              {listings.map((l) => (
                <div key={l.sku} className={s.leadRow}>
                  <span className={s.leadName} title={l.title ?? l.sku}>{l.title ?? l.sku}</span>
                  <span className={s.leadSub}>
                    {l.sku}
                    {l.price != null && ` · ${Number(l.price).toFixed(2)} ${config.currency}`}
                    {l.error && <span className={f.errMsg} title={l.error}>{l.error}</span>}
                  </span>
                  <span className={f.st} data-s={l.status}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className={accent ? s.statAccent : s.stat}>
      <div className={s.statValue}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}
