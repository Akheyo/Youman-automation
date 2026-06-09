'use client';

/**
 * A&B Vertrieb — Dashboard (client component).
 *
 * Reads leads from /api/vertrieb/leads (which proxies the n8n "Vertrieb — API"
 * workflow → Google Sheet) and lets the user change status / assignee / notes,
 * persisted back via /api/vertrieb/update.
 *
 * No Google credentials live here — the browser only ever talks to our own
 * Next.js API routes, which talk to n8n server-side.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './vertrieb.module.css';

const STATUSES = ['Neu', 'Kontaktiert', 'Termin', 'Angebot', 'Gewonnen', 'Verloren'] as const;
const DEFAULT_REPS = ['Anna', 'Felix', 'Paul'];
const REFRESH_MS = 60_000;

type Lead = Record<string, string | number>;

interface ApiResponse {
  leads?: Lead[];
  reps?: string[];
  byStatus?: Record<string, number>;
  byRep?: Record<string, number>;
  generatedAt?: string;
  error?: string;
  action?: string;
}

function str(v: string | number | undefined): string {
  return v === undefined || v === null ? '' : String(v);
}

function num(v: string | number | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(v: string | number | undefined): string {
  const s = str(v);
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reps, setReps] = useState<string[]>(DEFAULT_REPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // local edits keyed by lead ID: { status, assignedTo, notes }
  const [edits, setEdits] = useState<Record<string, Partial<Record<'Status' | 'Zugewiesen an' | 'Notizen', string>>>>({});

  const [fStatus, setFStatus] = useState('');
  const [fRep, setFRep] = useState('');
  const [fSearch, setFSearch] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/vertrieb/leads', { cache: 'no-store' });
      const data: ApiResponse = await res.json();
      if (!res.ok) {
        setError(`${data.error ?? 'Fehler beim Laden.'}${data.action ? ' — ' + data.action : ''}`);
        setLeads([]);
      } else {
        setError(null);
        setLeads(Array.isArray(data.leads) ? data.leads : []);
        if (Array.isArray(data.reps) && data.reps.length) setReps(data.reps);
      }
    } catch (e) {
      setError('Verbindung zur API fehlgeschlagen.');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, REFRESH_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const effective = useCallback(
    (lead: Lead, field: 'Status' | 'Zugewiesen an' | 'Notizen'): string => {
      const id = str(lead.ID);
      const e = edits[id];
      if (e && e[field] !== undefined) return e[field] as string;
      return str(lead[field]);
    },
    [edits],
  );

  const setEdit = (id: string, field: 'Status' | 'Zugewiesen an' | 'Notizen', value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const isDirty = (id: string) => {
    const e = edits[id];
    if (!e) return false;
    const lead = leads.find((l) => str(l.ID) === id);
    if (!lead) return false;
    return (['Status', 'Zugewiesen an', 'Notizen'] as const).some(
      (f) => e[f] !== undefined && e[f] !== str(lead[f]),
    );
  };

  const save = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    setSavingId(id);
    try {
      const res = await fetch('/api/vertrieb/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: e['Status'],
          assignedTo: e['Zugewiesen an'],
          notes: e['Notizen'],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Speichern fehlgeschlagen.');
        return;
      }
      // apply locally, clear edit, then refresh from source
      setLeads((prev) =>
        prev.map((l) => {
          if (str(l.ID) !== id) return l;
          return { ...l, ...(e as Lead) };
        }),
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setError(null);
      load();
    } catch {
      setError('Speichern fehlgeschlagen (Verbindung).');
    } finally {
      setSavingId(null);
    }
  };

  // ---- derived stats (use effective status so the UI feels live) ----
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byRep: Record<string, number> = {};
    const wonByRep: Record<string, number> = {};
    for (const l of leads) {
      const s = effective(l, 'Status') || 'Neu';
      byStatus[s] = (byStatus[s] || 0) + 1;
      const a = effective(l, 'Zugewiesen an') || 'Nicht zugewiesen';
      byRep[a] = (byRep[a] || 0) + 1;
      if (s === 'Gewonnen') wonByRep[a] = (wonByRep[a] || 0) + 1;
    }
    const total = leads.length;
    const won = byStatus['Gewonnen'] || 0;
    const lost = byStatus['Verloren'] || 0;
    const open = total - won - lost;
    const decided = won + lost;
    const conversion = decided > 0 ? Math.round((won / decided) * 100) : 0;
    return { byStatus, byRep, wonByRep, total, won, lost, open, conversion };
  }, [leads, effective]);

  const filtered = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return leads.filter((l) => {
      if (fStatus && (effective(l, 'Status') || 'Neu') !== fStatus) return false;
      if (fRep && (effective(l, 'Zugewiesen an') || '') !== fRep) return false;
      if (q) {
        const hay = `${str(l.Name)} ${str(l.Adresse)} ${str(l.Email)} ${str(l.Telefon)} ${str(l.ID)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, fStatus, fRep, fSearch, effective]);

  const repOptions = useMemo(() => {
    const set = new Set<string>(reps);
    leads.forEach((l) => {
      const a = str(l['Zugewiesen an']);
      if (a) set.add(a);
    });
    return Array.from(set);
  }, [reps, leads]);

  return (
    <div className={styles.shell}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>A&amp;B Vertrieb</h1>
          <div className={styles.subtitle}>
            Lead-Übersicht &amp; Steuerung{' '}
            {!loading && <>· {stats.total} Leads · aktualisiert {new Date().toLocaleTimeString('de-DE')}</>}
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={load} disabled={loading}>
            ↻ Aktualisieren
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          ⚠️ {error}
        </div>
      )}

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Leads gesamt</div>
          <div className={styles.kpiValue}>{stats.total}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Neu</div>
          <div className={styles.kpiValue} style={{ color: 'var(--blue)' }}>{stats.byStatus['Neu'] || 0}</div>
          <div className={styles.kpiSub}>unbearbeitet</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>In Bearbeitung</div>
          <div className={styles.kpiValue}>{stats.open}</div>
          <div className={styles.kpiSub}>offene Pipeline</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Gewonnen</div>
          <div className={styles.kpiValue} style={{ color: 'var(--green)' }}>{stats.won}</div>
          <div className={styles.kpiSub}>{stats.lost} verloren</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Conversion</div>
          <div className={styles.kpiValue}>{stats.conversion}%</div>
          <div className={styles.kpiSub}>gewonnen / entschieden</div>
        </div>
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Team</h2>
        <div className={styles.team}>
          {repOptions.map((rep) => (
            <div key={rep} className={styles.teamCard}>
              <div className={styles.teamName}>{rep}</div>
              <div className={styles.teamCount}>{stats.byRep[rep] || 0}</div>
              <div className={styles.kpiSub}>
                {stats.wonByRep[rep] || 0} gewonnen
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.filters}>
        <input
          className={`${styles.input} ${styles.search}`}
          placeholder="Suche: Name, Adresse, E-Mail…"
          value={fSearch}
          onChange={(e) => setFSearch(e.target.value)}
        />
        <select className={styles.select} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Alle Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={styles.select} value={fRep} onChange={(e) => setFRep(e.target.value)}>
          <option value="">Alle Mitarbeiter</option>
          {repOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Eingang</th>
              <th>Kontakt</th>
              <th>Adresse</th>
              <th>Anlage</th>
              <th>Ersparnis/J.</th>
              <th>Status</th>
              <th>Zugewiesen</th>
              <th>Notizen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const id = str(l.ID);
              const dirty = isDirty(id);
              return (
                <tr key={id} className={dirty ? styles.dirtyRow : undefined}>
                  <td>{id}</td>
                  <td>{fmtDate(l.Eingang)}</td>
                  <td className={styles.contact}>
                    <strong>{str(l.Name)}</strong>
                    <br />
                    <small>{str(l.Telefon)}</small>
                    <br />
                    <small>{str(l.Email)}</small>
                  </td>
                  <td className={styles.contact}>{str(l.Adresse)}</td>
                  <td>
                    {str(l.kWp) ? `${str(l.kWp)} kWp` : '—'}
                    <br />
                    <small className="muted">{str(l.Module)} Module</small>
                  </td>
                  <td>{num(l['Ersparnis EUR/Jahr']) ? `${num(l['Ersparnis EUR/Jahr']).toLocaleString('de-DE')} €` : '—'}</td>
                  <td>
                    <select
                      className={`${styles.select} ${styles.badge} ${styles['st_' + (effective(l, 'Status') || 'Neu')] ?? ''}`}
                      value={effective(l, 'Status') || 'Neu'}
                      onChange={(e) => setEdit(id, 'Status', e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={effective(l, 'Zugewiesen an')}
                      onChange={(e) => setEdit(id, 'Zugewiesen an', e.target.value)}
                    >
                      <option value="">—</option>
                      {repOptions.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={`${styles.input} ${styles.notesInput}`}
                      value={effective(l, 'Notizen')}
                      placeholder="Notiz…"
                      onChange={(e) => setEdit(id, 'Notizen', e.target.value)}
                    />
                  </td>
                  <td>
                    {savingId === id ? (
                      <span className={styles.saving}>speichert…</span>
                    ) : (
                      <button
                        className={styles.btnPrimary + ' ' + styles.btn}
                        disabled={!dirty}
                        onClick={() => save(id)}
                      >
                        Speichern
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            {leads.length === 0
              ? 'Noch keine Leads. Sobald über den Konfigurator eine Anfrage kommt, erscheint sie hier.'
              : 'Keine Leads für diese Filter.'}
          </div>
        )}
        {loading && <div className={styles.empty}>Lädt…</div>}
      </div>
    </div>
  );
}
