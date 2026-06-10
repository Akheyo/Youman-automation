'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './sales.module.css';

interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  phone: string;
  website: string | null;
  email: string | null;
  notes: string | null;
  source: string;
  interest: string;
  approved: boolean;
  needs_approval: boolean;
  status: string;
}
interface Call {
  id: string;
  status: string;
  outcome: string | null;
  duration_sec: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  created_at: string;
  call_leads: { name: string | null; company: string | null; phone: string } | null;
}
interface Meeting {
  id: string;
  contact_name: string | null;
  company: string | null;
  requested_time: string | null;
  status: string;
}
interface Config {
  agent_name: string;
  voice: string;
  goal: string;
  opening_line: string;
  persona: string;
  guidelines: string;
  dos: string;
  donts: string;
  max_duration: number;
}

type Tab = 'overview' | 'leads' | 'calls' | 'config';

const STATUS_LABEL: Record<string, string> = {
  neu: 'Neu',
  bereit: 'Bereit',
  anruf: 'Anruf läuft',
  erledigt: 'Erledigt',
  kein_interesse: 'Kein Interesse',
  nicht_erreicht: 'Nicht erreicht',
};

export default function SalesCockpit(props: {
  email: string;
  planName: string;
  callsUsed: number;
  callsLimit: number;
  googleEmail: string | null;
  googleConfigured: boolean;
  vapiReady: boolean;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function loadLeads() {
    const r = await fetch('/api/sales/leads');
    if (r.ok) setLeads((await r.json()).leads);
  }
  async function loadCalls() {
    const r = await fetch('/api/sales/calls');
    if (r.ok) {
      const d = await r.json();
      setCalls(d.calls);
      setMeetings(d.meetings);
    }
  }
  async function loadConfig() {
    const r = await fetch('/api/sales/config');
    if (r.ok) setConfig((await r.json()).config);
  }
  useEffect(() => {
    loadLeads();
    loadCalls();
    loadConfig();
  }, []);

  async function call(id: string, fn: () => Promise<Response>, after?: () => Promise<void>) {
    setBusy(id);
    setErr('');
    try {
      const r = await fn();
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? 'Fehler');
      else if (after) await after();
    } finally {
      setBusy(null);
    }
  }

  const approved = leads.filter((l) => l.approved || !l.needs_approval);
  const waiting = leads.filter((l) => l.needs_approval && !l.approved);
  const meetingsBooked = meetings.filter((m) => m.status === 'gebucht').length;
  const doneCalls = calls.filter((c) => c.status === 'beendet').length;
  const successRate = doneCalls ? Math.round((meetingsBooked / doneCalls) * 100) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroAv}>📞</div>
        <div>
          <h1 className={styles.h1}>Lina — dein KI-Telefon-Agent</h1>
          <p className={styles.heroSub}>
            Lina ruft deine Leads an, führt das Gespräch, prüft deinen Kalender und bucht den Termin direkt ein.
          </p>
        </div>
      </div>

      {/* Setup banners */}
      {!props.vapiReady && (
        <div className={styles.warn}>
          ⚙️ Telefonie (Vapi) ist noch nicht verbunden. Anrufe sind erst möglich, sobald der Vapi-API-Key & eine Nummer
          hinterlegt sind.
        </div>
      )}
      {props.vapiReady && !props.googleEmail && (
        <div className={styles.warn}>
          📅 Verbinde deinen Google-Kalender, damit Lina Termine selbst buchen kann.{' '}
          {props.googleConfigured ? (
            <a href="/api/google/connect" className={styles.warnBtn}>
              Jetzt verbinden
            </a>
          ) : (
            <span>(Google ist noch nicht konfiguriert.)</span>
          )}
        </div>
      )}
      {props.googleEmail && <div className={styles.ok}>📅 Kalender verbunden: {props.googleEmail}</div>}

      <nav className={styles.tabs}>
        {(
          [
            ['overview', 'Übersicht'],
            ['leads', `Leads (${leads.length})`],
            ['calls', `Anrufe (${calls.length})`],
            ['config', 'Lina-Konfig'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? styles.tabActive : styles.tab} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </nav>

      {err && <div className={styles.err}>{err}</div>}

      <main className={styles.main}>
        {tab === 'overview' && (
          <Overview
            planName={props.planName}
            callsUsed={props.callsUsed}
            callsLimit={props.callsLimit}
            total={leads.length}
            approved={approved.length}
            waiting={waiting.length}
            doneCalls={doneCalls}
            meetingsBooked={meetingsBooked}
            successRate={successRate}
            meetings={meetings}
          />
        )}

        {tab === 'leads' && (
          <Leads
            leads={leads}
            busy={busy}
            onAdded={loadLeads}
            onCall={(id) => call(id, () => fetch('/api/sales/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: id }) }), async () => { await loadLeads(); await loadCalls(); })}
            onApprove={(id, v) => call(id, () => fetch(`/api/sales/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: v }) }), loadLeads)}
            onDelete={(id) => call(id, () => fetch(`/api/sales/leads/${id}`, { method: 'DELETE' }), loadLeads)}
            setErr={setErr}
          />
        )}

        {tab === 'calls' && <Calls calls={calls} />}

        {tab === 'config' && config && <ConfigForm config={config} onSaved={loadConfig} setErr={setErr} />}
      </main>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className={accent ? styles.statAccent : styles.stat}>
      <div className={styles.statVal}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function Overview(p: {
  planName: string;
  callsUsed: number;
  callsLimit: number;
  total: number;
  approved: number;
  waiting: number;
  doneCalls: number;
  meetingsBooked: number;
  successRate: number;
  meetings: Meeting[];
}) {
  return (
    <>
      <div className={styles.statGrid}>
        <Stat value={p.total} label="Leads gesamt" />
        <Stat value={p.approved} label="Freigegeben" />
        <Stat value={p.waiting} label="Warten auf Freigabe" />
        <Stat value={p.doneCalls} label="Anrufe geführt" />
        <Stat value={p.meetingsBooked} label="Termine gebucht" accent />
        <Stat value={`${p.successRate}%`} label="Erfolgsquote" accent />
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>Anruf-Kontingent ({p.planName})</div>
        <div className={styles.usageHead}>
          <span>KI-Anrufe diesen Monat</span>
          <span>
            {p.callsUsed} / {p.callsLimit}
          </span>
        </div>
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${Math.min(100, Math.round((p.callsUsed / Math.max(1, p.callsLimit)) * 100))}%` }} />
        </div>
        <Link href="/pricing" className={styles.upgrade}>
          Mehr Anrufe freischalten →
        </Link>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>Nächste Termine</div>
        {p.meetings.length === 0 ? (
          <p className={styles.muted}>Noch keine Termine. Sobald Lina einen Termin bucht, erscheint er hier.</p>
        ) : (
          <ul className={styles.meetList}>
            {p.meetings.slice(0, 8).map((m) => (
              <li key={m.id}>
                <strong>{m.contact_name ?? 'Kontakt'}</strong>
                {m.requested_time && <span> · {new Date(m.requested_time).toLocaleString('de-DE')}</span>}
                <span className={styles.pill}>{m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Leads(p: {
  leads: Lead[];
  busy: string | null;
  onAdded: () => Promise<void>;
  onCall: (id: string) => void;
  onApprove: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  setErr: (s: string) => void;
}) {
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', notes: '' });
  const [csv, setCsv] = useState('');
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    p.setErr('');
    const r = await fetch('/api/sales/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (r.ok) {
      setForm({ name: '', company: '', phone: '', email: '', notes: '' });
      await p.onAdded();
    } else p.setErr((await r.json().catch(() => ({}))).error ?? 'Fehler');
    setAdding(false);
  }
  async function importCsv() {
    if (!csv.trim()) return;
    setAdding(true);
    const r = await fetch('/api/sales/leads/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
    if (r.ok) {
      setCsv('');
      await p.onAdded();
    } else p.setErr((await r.json().catch(() => ({}))).error ?? 'Fehler');
    setAdding(false);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.readAsText(f);
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHead}>Lead hinzufügen</div>
        <form className={styles.addForm} onSubmit={add}>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Firma" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input placeholder="Telefon *" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Notiz / Analyse" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" disabled={adding}>
            Hinzufügen
          </button>
        </form>
        <div className={styles.csvRow}>
          <label className={styles.fileBtn}>
            CSV wählen
            <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          </label>
          <textarea placeholder="…oder CSV hier einfügen (Name;Firma;Telefon;Website;E-Mail)" value={csv} onChange={(e) => setCsv(e.target.value)} />
          <button onClick={importCsv} disabled={adding || !csv.trim()}>
            Importieren
          </button>
        </div>
        <p className={styles.hint}>CSV-Leads landen in „Warten auf Freigabe&ldquo; — gib sie frei, bevor Lina anruft.</p>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>Leads ({p.leads.length})</div>
        {p.leads.length === 0 ? (
          <p className={styles.muted}>Noch keine Leads. Füge oben welche hinzu oder übergib sie aus Felix.</p>
        ) : (
          <div className={styles.leadList}>
            {p.leads.map((l) => (
              <div key={l.id} className={styles.leadRow}>
                <div className={styles.leadMain}>
                  <div className={styles.leadName}>
                    {l.name || l.company || l.phone}
                    {l.company && l.name && <span className={styles.leadCo}> · {l.company}</span>}
                    <span className={styles.statusPill} data-s={l.status}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </div>
                  <div className={styles.leadMeta}>
                    {l.phone}
                    {l.notes && ` · ${l.notes}`}
                    {l.source === 'csv' && <span className={styles.srcPill}>CSV</span>}
                    {l.source === 'felix' && <span className={styles.srcPill}>Felix</span>}
                  </div>
                </div>
                <div className={styles.leadActions}>
                  {l.needs_approval && !l.approved ? (
                    <button className={styles.approveBtn} onClick={() => p.onApprove(l.id, true)} disabled={p.busy === l.id}>
                      Freigeben
                    </button>
                  ) : (
                    <button className={styles.callBtn} onClick={() => p.onCall(l.id)} disabled={p.busy === l.id || l.status === 'anruf'}>
                      {p.busy === l.id ? '…' : '📞 Anrufen'}
                    </button>
                  )}
                  <button className={styles.delBtn} onClick={() => p.onDelete(l.id)} disabled={p.busy === l.id} title="Löschen">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Calls({ calls }: { calls: Call[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (calls.length === 0)
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Noch keine Anrufe. Sobald Lina telefoniert, erscheinen hier Verlauf, Zusammenfassung und Transkript.</p>
      </div>
    );
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>Anruf-Verlauf</div>
      <div className={styles.callList}>
        {calls.map((c) => {
          const who = c.call_leads?.name || c.call_leads?.company || c.call_leads?.phone || 'Unbekannt';
          const isOpen = open === c.id;
          return (
            <div key={c.id} className={styles.callRow}>
              <button className={styles.callHead} onClick={() => setOpen(isOpen ? null : c.id)}>
                <span className={styles.callWho}>{who}</span>
                <span className={styles.callMeta}>
                  {c.outcome && <span className={styles.outcomePill} data-o={c.outcome}>{c.outcome}</span>}
                  <span className={styles.callStatus}>{c.status}</span>
                  {c.duration_sec != null && <span>{Math.floor(c.duration_sec / 60)}:{String(c.duration_sec % 60).padStart(2, '0')} min</span>}
                  <span className={styles.callDate}>{new Date(c.created_at).toLocaleString('de-DE')}</span>
                </span>
              </button>
              {isOpen && (
                <div className={styles.callBody}>
                  {c.summary && (
                    <div className={styles.summary}>
                      <strong>Zusammenfassung:</strong> {c.summary}
                    </div>
                  )}
                  {c.recording_url && (
                    <audio controls src={c.recording_url} className={styles.audio} />
                  )}
                  {c.transcript ? (
                    <pre className={styles.transcript}>{c.transcript}</pre>
                  ) : (
                    <p className={styles.muted}>Noch kein Transkript (Anruf evtl. noch nicht beendet).</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigForm({ config, onSaved, setErr }: { config: Config; onSaved: () => Promise<void>; setErr: (s: string) => void }) {
  const [c, setC] = useState<Config>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErr('');
    const r = await fetch('/api/sales/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    if (r.ok) {
      setSaved(true);
      await onSaved();
    } else setErr((await r.json().catch(() => ({}))).error ?? 'Fehler');
    setSaving(false);
  }

  const field = (k: keyof Config, label: string, area = false) => (
    <label className={styles.cfgField}>
      <span>{label}</span>
      {area ? (
        <textarea value={String(c[k] ?? '')} onChange={(e) => setC({ ...c, [k]: e.target.value })} rows={2} />
      ) : (
        <input value={String(c[k] ?? '')} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
      )}
    </label>
  );

  return (
    <form className={styles.card} onSubmit={save}>
      <div className={styles.cardHead}>Lina-Konfiguration (ihr „Charakter&ldquo;)</div>
      <p className={styles.hint}>Hier bestimmst du, wie Lina am Telefon auftritt — wie bei einem Persona-Profil.</p>
      {field('agent_name', 'Name des Agenten')}
      {field('opening_line', 'Eröffnungssatz', true)}
      {field('goal', 'Ziel des Anrufs', true)}
      {field('persona', 'Persönlichkeit / Tonfall', true)}
      {field('guidelines', 'Gesprächsleitfaden', true)}
      {field('dos', 'Das soll Lina tun', true)}
      {field('donts', 'Das soll Lina NICHT tun', true)}
      <label className={styles.cfgField}>
        <span>Max. Gesprächsdauer (Sekunden)</span>
        <input type="number" value={c.max_duration} onChange={(e) => setC({ ...c, max_duration: Number(e.target.value) })} />
      </label>
      <div className={styles.cfgActions}>
        <button type="submit" disabled={saving}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        {saved && <span className={styles.savedMsg}>✓ Gespeichert</span>}
      </div>
    </form>
  );
}
