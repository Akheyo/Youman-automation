'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ORDER_TYPES } from '@/lib/projekte/logic';
import styles from './projekte.module.css';

export interface Projekt {
  id: string;
  company: string;
  location: string;
  contact_internal: string | null;
  contact_external: string | null;
  notes: string | null;
  order_type: string | null;
  invoice_name: string | null;
  category_name: string | null;
  ean: string | null;
  plenty_category_id: number | null;
  plenty_item_id: number | null;
  plenty_status: 'pending' | 'ok' | 'skipped' | 'error';
  plenty_error: string | null;
  created_at: string;
}

interface SyncInfo {
  ok: boolean;
  skipped: boolean;
  status: string;
  ean: string;
  categoryCreated: boolean;
  eanAttached: boolean;
  invoiceAttached: boolean;
  invoiceStored: boolean;
  invoiceUrl: string | null;
  warnings: string[];
  error: string | null;
}

const EMPTY = { company: '', location: '', contactInternal: '', contactExternal: '', notes: '', orderType: '' };

/** Sichtbarer Build-Marker – so erkennt man sofort, ob die neue Version live ist. */
const APP_BUILD = 'relation-value-2';

export default function ProjektDashboard({
  initial,
  plentyReady,
  supabaseReady,
}: {
  initial: Projekt[];
  plentyReady: boolean;
  supabaseReady: boolean;
}) {
  const [form, setForm] = useState(EMPTY);
  const [projekte, setProjekte] = useState<Projekt[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ projekt: Projekt; sync: SyncInfo } | null>(null);
  const [query, setQuery] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryPreview = useMemo(() => {
    const c = form.company.trim().replace(/\s+/g, ' ');
    const l = form.location.trim().replace(/\s+/g, ' ');
    return [c, l].filter(Boolean).join(' ');
  }, [form.company, form.location]);

  useEffect(() => {
    if (!supabaseReady) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projekte?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setProjekte(data.projekte ?? []);
        }
      } catch {
        /* Suche unkritisch */
      }
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, supabaseReady]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (form.company.trim().length < 2) return setError('Bitte einen Firmennamen angeben.');
    if (form.location.trim().length < 2) return setError('Bitte einen Ort angeben.');

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('company', form.company);
      fd.append('location', form.location);
      fd.append('contactInternal', form.contactInternal);
      fd.append('contactExternal', form.contactExternal);
      fd.append('notes', form.notes);
      fd.append('orderType', form.orderType);
      if (file) fd.append('invoice', file);

      const res = await fetch('/api/projekte', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Serverfehler (HTTP ${res.status}).`);
      setResult({ projekt: data.projekt, sync: data.sync });
      setProjekte((prev) => [data.projekt as Projekt, ...prev.filter((p) => p.id !== data.projekt.id)]);
      setForm(EMPTY);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onRetry(id: string) {
    setRetrying(id);
    try {
      const res = await fetch(`/api/projekte/${id}/sync`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Serverfehler (HTTP ${res.status}).`);
      setProjekte((prev) => prev.map((p) => (p.id === id ? (data.projekt as Projekt) : p)));
      if (result?.projekt.id === id) setResult({ projekt: data.projekt, sync: data.sync });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRetrying(null);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Diesen Eintrag aus dem Verlauf entfernen? (In Plenty wird nichts gelöscht.)')) return;
    const res = await fetch(`/api/projekte/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjekte((prev) => prev.filter((p) => p.id !== id));
      if (result?.projekt.id === id) setResult(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>PlentyONE · Projektanlage</span>
        <h1 className={styles.title}>Projektplanung</h1>
        <p className={styles.subtitle}>
          Projekt erfassen → Unterkategorie <strong>„Firma&nbsp;Ort“</strong> in Plenty anlegen → Artikel mit
          automatischer EAN-13 erzeugen.
        </p>
      </header>

      {!supabaseReady && (
        <div className={`${styles.notice} ${styles.noticeWarn}`} role="status">
          Supabase ist nicht konfiguriert – Login &amp; Suchverlauf sind deaktiviert.
        </div>
      )}

      <div className={styles.grid}>
        {/* ---- Formular ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Neues Projekt</h2>
            <StatusChip ready={plentyReady} />
          </div>

          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles.row2}>
              <Field label="Firmenname" required>
                <input
                  className={styles.input}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="z. B. Bosch GmbH"
                  autoFocus
                />
              </Field>
              <Field label="Ort" required>
                <input
                  className={styles.input}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="z. B. Esslingen"
                />
              </Field>
            </div>

            <div className={styles.row2}>
              <Field label="Ansprechpartner intern">
                <input
                  className={styles.input}
                  value={form.contactInternal}
                  onChange={(e) => setForm({ ...form, contactInternal: e.target.value })}
                  placeholder="z. B. Anna Müller"
                />
              </Field>
              <Field label="Ansprechpartner extern">
                <input
                  className={styles.input}
                  value={form.contactExternal}
                  onChange={(e) => setForm({ ...form, contactExternal: e.target.value })}
                  placeholder="z. B. Herr Schmidt"
                />
              </Field>
            </div>

            <Field label="Auftragstyp">
              <select
                className={styles.input}
                value={form.orderType}
                onChange={(e) => setForm({ ...form, orderType: e.target.value })}
              >
                <option value="">— bitte wählen —</option>
                {ORDER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Anmerkungen">
              <textarea
                className={styles.textarea}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Randnotizen zum Projekt (optional)…"
                rows={3}
              />
            </Field>

            <Field label="Rechnung (wird als Dokument 1 an den Artikel gehängt)">
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dropzoneOver : ''} ${file ? styles.dropzoneFilled : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFile(f);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className={styles.fileInputHidden}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <span className={styles.fileChosen}>
                    <DocIcon />
                    <span className={styles.fileName}>{file.name}</span>
                    <button
                      type="button"
                      className={styles.fileRemove}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      aria-label="Datei entfernen"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span className={styles.dropzoneHint}>
                    <UploadIcon />
                    Rechnung hierher ziehen oder klicken zum Auswählen
                  </span>
                )}
              </div>
            </Field>

            {categoryPreview && (
              <p className={styles.preview}>
                Unterkategorie: <span className={styles.previewTag}>{categoryPreview}</span>
              </p>
            )}

            {error && (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            )}

            <button type="submit" className={styles.submit} disabled={busy || !supabaseReady}>
              {busy ? 'Wird angelegt…' : 'Projekt anlegen'}
            </button>
          </form>

          {result && (
            <ResultCard result={result} retrying={retrying === result.projekt.id} onRetry={() => onRetry(result.projekt.id)} />
          )}
        </section>

        {/* ---- Suchverlauf ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Suchverlauf</h2>
            <span className={styles.count}>{projekte.length}</span>
          </div>

          <div className={styles.searchBox}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Firma, Ort, Ansprechpartner oder EAN suchen…"
              disabled={!supabaseReady}
            />
          </div>

          {projekte.length === 0 ? (
            <p className={styles.empty}>{query ? 'Keine Treffer.' : 'Noch keine Projekte erfasst.'}</p>
          ) : (
            <ul className={styles.list}>
              {projekte.map((p) => (
                <li key={p.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemName}>{p.category_name || `${p.company} ${p.location}`}</span>
                    <span className={styles.itemMeta}>
                      {[p.order_type, p.contact_internal, p.contact_external].filter(Boolean).join(' · ') || '—'}
                    </span>
                    {p.ean && <span className={styles.itemEan}>EAN {p.ean}</span>}
                    {p.invoice_name && (
                      <a
                        className={styles.itemInvoice}
                        href={`/api/projekte/${p.id}/invoice`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Rechnung öffnen: ${p.invoice_name}`}
                      >
                        <ClipIcon /> {p.invoice_name}
                      </a>
                    )}
                    {p.notes && <span className={styles.itemNote} title={p.notes}>✎ {p.notes}</span>}
                  </div>
                  <div className={styles.itemSide}>
                    <PlentyBadge status={p.plenty_status} />
                    {p.plenty_status !== 'ok' && (
                      <button
                        className={styles.retryBtn}
                        onClick={() => onRetry(p.id)}
                        disabled={retrying === p.id}
                        title="Erneut mit Plenty synchronisieren"
                      >
                        {retrying === p.id ? '…' : '↻'}
                      </button>
                    )}
                    <span className={styles.itemDate}>{new Date(p.created_at).toLocaleDateString('de-DE')}</span>
                    <button className={styles.del} onClick={() => onDelete(p.id)} aria-label="Aus Verlauf entfernen" title="Aus Verlauf entfernen">
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------- */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {required && (
          <span className={styles.req} aria-hidden>
            {' '}
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function StatusChip({ ready }: { ready: boolean }) {
  return (
    <span className={`${styles.chip} ${ready ? styles.chipOk : styles.chipOff}`}>
      <span className={styles.dot} />
      {ready ? 'Plenty konfiguriert' : 'Plenty offline'}
    </span>
  );
}

function PlentyBadge({ status }: { status: Projekt['plenty_status'] }) {
  const map: Record<Projekt['plenty_status'], { label: string; cls: string }> = {
    ok: { label: 'In Plenty', cls: styles.badgeOk },
    skipped: { label: 'nur EAN', cls: styles.badgeMuted },
    pending: { label: 'offen', cls: styles.badgeMuted },
    error: { label: 'Fehler', cls: styles.badgeErr },
  };
  const b = map[status] ?? map.pending;
  return <span className={`${styles.badge} ${b.cls}`}>{b.label}</span>;
}

function ResultCard({
  result,
  retrying,
  onRetry,
}: {
  result: { projekt: Projekt; sync: SyncInfo };
  retrying: boolean;
  onRetry: () => void;
}) {
  const { projekt, sync } = result;
  const state: 'ok' | 'skipped' | 'error' = sync.ok ? (sync.skipped ? 'skipped' : 'ok') : 'error';

  const cls =
    state === 'ok' ? styles.resOk : state === 'skipped' ? styles.resInfo : styles.resErr;
  const heading =
    state === 'ok'
      ? sync.eanAttached
        ? 'In Plenty angelegt – Barcode gesetzt'
        : 'In Plenty angelegt'
      : state === 'skipped'
        ? 'Gespeichert – Plenty nicht verbunden'
        : 'Plenty-Sync fehlgeschlagen';

  return (
    <div className={`${styles.result} ${cls}`} role="status">
      <div className={styles.resultHead}>
        {state === 'error' ? <AlertIcon /> : <CheckIcon />}
        <strong>{heading}</strong>
      </div>

      <dl className={styles.resultGrid}>
        <div>
          <dt>Unterkategorie</dt>
          <dd>
            {projekt.category_name}
            {state === 'ok' && (sync.categoryCreated ? ' (neu)' : ' (vorhanden)')}
          </dd>
        </div>
        <div>
          <dt>EAN-13</dt>
          <dd className={styles.mono}>{sync.ean}</dd>
        </div>
        {projekt.plenty_item_id != null && (
          <div>
            <dt>Plenty-Artikel</dt>
            <dd className={styles.mono}>#{projekt.plenty_item_id}</dd>
          </div>
        )}
        {projekt.order_type && (
          <div>
            <dt>Auftragstyp</dt>
            <dd>{projekt.order_type}</dd>
          </div>
        )}
        {sync.invoiceStored && (
          <div>
            <dt>Rechnung</dt>
            <dd>
              {sync.invoiceAttached ? 'als „Dokument 1" in Plenty hinterlegt' : 'gespeichert'}
              {' — '}
              <a href={`/api/projekte/${projekt.id}/invoice`} target="_blank" rel="noreferrer" className={styles.invoiceLink}>
                öffnen
              </a>
            </dd>
          </div>
        )}
      </dl>

      {state === 'error' && (
        <div className={styles.errorBox}>
          <p className={styles.errorWhat}>
            <strong>Was schiefging:</strong> {sync.error}
          </p>
          <p className={styles.errorFallback}>
            ✓ Das Projekt und die EAN <span className={styles.mono}>{sync.ean}</span> wurden gespeichert – es ging nichts
            verloren. Du kannst den Plenty-Abgleich jederzeit wiederholen.
          </p>
          <button className={styles.retryAction} onClick={onRetry} disabled={retrying}>
            {retrying ? 'Synchronisiere…' : '↻ Erneut synchronisieren'}
          </button>
        </div>
      )}

      {state === 'skipped' && (
        <p className={styles.hint}>
          Trage die Plenty-Zugangsdaten ein (Environment Variables), dann werden Kategorie &amp; Artikel automatisch
          angelegt. EAN wurde bereits erzeugt und gespeichert.
        </p>
      )}

      {sync.warnings?.length > 0 && (
        <ul className={styles.warnList}>
          {sync.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <p className={styles.buildTag}>Build: {APP_BUILD}</p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}
