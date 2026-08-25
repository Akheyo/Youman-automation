'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './projekte.module.css';

export interface Projekt {
  id: string;
  company: string;
  location: string;
  contact_internal: string | null;
  contact_external: string | null;
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
  warnings: string[];
  error: string | null;
}

const EMPTY = { company: '', location: '', contactInternal: '', contactExternal: '' };

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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryPreview = useMemo(() => {
    const c = form.company.trim().replace(/\s+/g, ' ');
    const l = form.location.trim().replace(/\s+/g, ' ');
    return [c, l].filter(Boolean).join(' ');
  }, [form.company, form.location]);

  // Debounced Suche über den Verlauf.
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
        /* Suche ist unkritisch */
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
      const res = await fetch('/api/projekte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Anlegen fehlgeschlagen.');
      setResult({ projekt: data.projekt, sync: data.sync });
      setProjekte((prev) => [data.projekt as Projekt, ...prev]);
      setForm(EMPTY);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Diesen Eintrag aus dem Verlauf entfernen? (In Plenty wird nichts gelöscht.)')) return;
    const res = await fetch(`/api/projekte/${id}`, { method: 'DELETE' });
    if (res.ok) setProjekte((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Projektplanung</h1>
          <p className={styles.subtitle}>
            Projekt erfassen → Unterkategorie <strong>„Firma&nbsp;Ort“</strong> in Plenty anlegen → Artikel mit
            automatischer EAN-13 erzeugen.
          </p>
        </div>
      </header>

      {!supabaseReady && (
        <div className={styles.banner} role="status">
          Supabase ist nicht konfiguriert – Login &amp; Suchverlauf sind deaktiviert. Trage die Umgebungsvariablen ein
          (siehe README).
        </div>
      )}

      <div className={styles.grid}>
        {/* ---- Formular ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Neues Projekt</h2>
            <StatusChip ready={plentyReady} label={plentyReady ? 'Plenty verbunden' : 'Plenty offline'} />
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

            {categoryPreview && (
              <p className={styles.preview}>
                Unterkategorie: <span className={styles.previewTag}>{categoryPreview}</span>
              </p>
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button type="submit" className={styles.submit} disabled={busy || !supabaseReady}>
              {busy ? 'Wird angelegt…' : 'Projekt anlegen'}
            </button>
          </form>

          {result && <ResultCard result={result} />}
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
                      {[p.contact_internal, p.contact_external].filter(Boolean).join(' · ') || '—'}
                    </span>
                    {p.ean && <span className={styles.itemEan}>EAN {p.ean}</span>}
                  </div>
                  <div className={styles.itemSide}>
                    <PlentyBadge status={p.plenty_status} />
                    <span className={styles.itemDate}>{new Date(p.created_at).toLocaleDateString('de-DE')}</span>
                    <button
                      className={styles.del}
                      onClick={() => onDelete(p.id)}
                      aria-label="Aus Verlauf entfernen"
                      title="Aus Verlauf entfernen"
                    >
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
        {required && <span className={styles.req} aria-hidden> *</span>}
      </span>
      {children}
    </label>
  );
}

function StatusChip({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span className={`${styles.chip} ${ready ? styles.chipOk : styles.chipOff}`}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}

function PlentyBadge({ status }: { status: Projekt['plenty_status'] }) {
  const map: Record<Projekt['plenty_status'], { label: string; cls: string }> = {
    ok: { label: 'Plenty ✓', cls: styles.badgeOk },
    skipped: { label: 'nur EAN', cls: styles.badgeMuted },
    pending: { label: 'läuft…', cls: styles.badgeMuted },
    error: { label: 'Fehler', cls: styles.badgeErr },
  };
  const b = map[status] ?? map.pending;
  return <span className={`${styles.badge} ${b.cls}`}>{b.label}</span>;
}

function ResultCard({ result }: { result: { projekt: Projekt; sync: SyncInfo } }) {
  const { projekt, sync } = result;
  return (
    <div className={styles.result} role="status">
      <div className={styles.resultHead}>
        <CheckIcon />
        <strong>Projekt angelegt</strong>
      </div>
      <dl className={styles.resultGrid}>
        <div>
          <dt>Unterkategorie</dt>
          <dd>{projekt.category_name}{sync.categoryCreated ? ' (neu)' : ' (vorhanden)'}</dd>
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
        <div>
          <dt>Status</dt>
          <dd>
            {sync.skipped
              ? 'EAN erzeugt (Plenty nicht verbunden)'
              : sync.ok
                ? sync.eanAttached
                  ? 'In Plenty angelegt, Barcode gesetzt'
                  : 'In Plenty angelegt'
                : 'Fehler beim Plenty-Sync'}
          </dd>
        </div>
      </dl>
      {sync.error && <p className={styles.resultErr}>{sync.error}</p>}
      {sync.warnings?.length > 0 && (
        <ul className={styles.warnList}>
          {sync.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
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
