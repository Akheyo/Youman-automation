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
  follow_up_at: string | null;
  follow_up_note: string | null;
  do_not_call?: boolean;
  anlass?: string | null;
}
interface Extracted {
  outcome?: string;
  budget?: string | null;
  bedarf?: string | null;
  entscheider?: boolean | null;
  naechster_schritt?: string | null;
}
interface Call {
  id: string;
  status: string;
  outcome: string | null;
  duration_sec: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  extracted: Extracted | null;
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
  record_calls: boolean;
  ai_disclosure: boolean;
  disclosure_text?: string | null;
  transfer_number?: string | null;
  voicemail_detection?: boolean;
  voicemail_message?: string | null;
}

type Tab = 'overview' | 'leads' | 'campaigns' | 'followups' | 'calls' | 'config';

interface Campaign {
  id: string;
  name: string;
  status: string;
  intensity: string;
  window_start: number;
  window_end: number;
  max_attempts: number;
  max_per_day: number;
  counts: { total: number; offen: number; erledigt: number; gesperrt: number };
}

const INTEREST_LABEL: Record<string, string> = { high: '🔥 Hohes Interesse', warm: '🌤️ Warm', unknown: 'Unbekannt' };

const STATUS_LABEL: Record<string, string> = {
  neu: 'Neu',
  bereit: 'Bereit',
  anruf: 'Anruf läuft',
  erledigt: 'Erledigt',
  kein_interesse: 'Kein Interesse',
  nicht_erreicht: 'Nicht erreicht',
};

const OUTCOME_LABEL: Record<string, string> = {
  termin: 'Termin',
  qualifiziert: 'Qualifiziert',
  rueckruf: 'Rückruf',
  kein_interesse: 'Kein Interesse',
  mailbox: 'Mailbox',
  nicht_erreicht: 'Nicht erreicht',
  erreicht: 'Erreicht',
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function loadLeads() {
    const r = await fetch('/api/sales/leads');
    if (r.ok) setLeads((await r.json()).leads);
  }
  async function loadCampaigns() {
    const r = await fetch('/api/sales/campaigns');
    if (r.ok) setCampaigns((await r.json()).campaigns);
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
    loadCampaigns();
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

  function save(id: string, patch: Record<string, unknown>) {
    return call(
      id,
      () => fetch(`/api/sales/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
      loadLeads,
    );
  }

  const approved = leads.filter((l) => l.approved || !l.needs_approval);
  const waiting = leads.filter((l) => l.needs_approval && !l.approved);
  const followUps = leads
    .filter((l) => l.follow_up_at)
    .sort((a, b) => (a.follow_up_at ?? '').localeCompare(b.follow_up_at ?? ''));
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
            ['campaigns', `Kampagnen (${campaigns.length})`],
            ['followups', `Follow-ups (${followUps.length})`],
            ['calls', `Anrufe (${calls.length})`],
            ['config', 'Lina-Persönlichkeit'],
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
            onSave={save}
            setErr={setErr}
          />
        )}

        {tab === 'followups' && (
          <FollowUps
            items={followUps}
            busy={busy}
            onCall={(id) => call(id, () => fetch('/api/sales/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: id }) }), async () => { await loadLeads(); await loadCalls(); })}
            onClear={(id) => save(id, { follow_up_at: null, follow_up_note: null })}
          />
        )}

        {tab === 'campaigns' && (
          <Campaigns
            campaigns={campaigns}
            approvedCount={approved.filter((l) => !l.do_not_call).length}
            busy={busy}
            vapiReady={props.vapiReady}
            onReload={async () => {
              await loadCampaigns();
              await loadLeads();
            }}
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
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void> | void;
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
              <LeadItem key={l.id} l={l} busy={p.busy} onCall={p.onCall} onApprove={p.onApprove} onDelete={p.onDelete} onSave={p.onSave} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function LeadItem({
  l,
  busy,
  onCall,
  onApprove,
  onDelete,
  onSave,
}: {
  l: Lead;
  busy: string | null;
  onCall: (id: string) => void;
  onApprove: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void> | void;
}) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    name: l.name ?? '',
    company: l.company ?? '',
    interest: l.interest ?? 'unknown',
    notes: l.notes ?? '',
    anlass: l.anlass ?? '',
    follow_up_at: l.follow_up_at ? l.follow_up_at.slice(0, 10) : '',
    follow_up_note: l.follow_up_note ?? '',
  });

  async function submit() {
    await onSave(l.id, {
      name: f.name || null,
      company: f.company || null,
      interest: f.interest,
      notes: f.notes || null,
      anlass: f.anlass || null,
      follow_up_at: f.follow_up_at || null,
      follow_up_note: f.follow_up_note || null,
    });
    setEdit(false);
  }

  if (edit) {
    return (
      <div className={styles.leadEdit}>
        <div className={styles.editGrid}>
          <label>
            <span>Name</span>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label>
            <span>Firma</span>
            <input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          </label>
          <label>
            <span>Interesse</span>
            <select value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })}>
              <option value="high">🔥 Hohes Interesse</option>
              <option value="warm">🌤️ Warm</option>
              <option value="unknown">Unbekannt</option>
            </select>
          </label>
          <label>
            <span>Follow-up am</span>
            <input type="date" value={f.follow_up_at} onChange={(e) => setF({ ...f, follow_up_at: e.target.value })} />
          </label>
        </div>
        <label className={styles.editFull}>
          <span>Anlass des Anrufs (rechtlicher Aufhänger — z.&nbsp;B. „keine Website&ldquo;, „offene Stelle&ldquo;)</span>
          <input value={f.anlass} onChange={(e) => setF({ ...f, anlass: e.target.value })} placeholder="Sachlicher Grund für die Kontaktaufnahme" />
        </label>
        <label className={styles.editFull}>
          <span>Analyse / Notizen (manuell bearbeitbar)</span>
          <textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </label>
        <label className={styles.editFull}>
          <span>Follow-up Notiz</span>
          <input value={f.follow_up_note} onChange={(e) => setF({ ...f, follow_up_note: e.target.value })} placeholder="z. B. nächste Woche erneut anrufen" />
        </label>
        <div className={styles.editActions}>
          <button className={styles.saveBtn} onClick={submit} disabled={busy === l.id}>
            Speichern
          </button>
          <button className={styles.cancelBtn} onClick={() => setEdit(false)}>
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.leadRow}>
      <div className={styles.leadMain}>
        <div className={styles.leadName}>
          {l.name || l.company || l.phone}
          {l.company && l.name && <span className={styles.leadCo}> · {l.company}</span>}
          <span className={styles.statusPill} data-s={l.status}>
            {STATUS_LABEL[l.status] ?? l.status}
          </span>
          {l.do_not_call && <span className={styles.dncPill}>🚫 Gesperrt</span>}
          {l.interest !== 'unknown' && <span className={styles.interestPill}>{INTEREST_LABEL[l.interest]}</span>}
        </div>
        <div className={styles.leadMeta}>
          {l.phone}
          {l.notes && ` · ${l.notes}`}
          {l.source === 'csv' && <span className={styles.srcPill}>CSV</span>}
          {l.source === 'felix' && <span className={styles.srcPill}>Felix</span>}
          {l.anlass && <span className={styles.anlassPill} title={l.anlass}>⚖ Anlass</span>}
          {l.follow_up_at && <span className={styles.fuPill}>↻ {new Date(l.follow_up_at).toLocaleDateString('de-DE')}</span>}
        </div>
      </div>
      <div className={styles.leadActions}>
        {l.do_not_call ? (
          <span className={styles.dncNote} title="Lead hat widersprochen — darf nicht angerufen werden.">Do-Not-Call</span>
        ) : l.needs_approval && !l.approved ? (
          <button className={styles.approveBtn} onClick={() => onApprove(l.id, true)} disabled={busy === l.id}>
            Freigeben
          </button>
        ) : (
          <button className={styles.callBtn} onClick={() => onCall(l.id)} disabled={busy === l.id || l.status === 'anruf'}>
            {busy === l.id ? '…' : '📞 Anrufen'}
          </button>
        )}
        <button className={styles.editBtn} onClick={() => setEdit(true)} title="Bearbeiten">
          ✎
        </button>
        <button className={styles.delBtn} onClick={() => onDelete(l.id)} disabled={busy === l.id} title="Löschen">
          ✕
        </button>
      </div>
    </div>
  );
}

function FollowUps({
  items,
  busy,
  onCall,
  onClear,
}: {
  items: Lead[];
  busy: string | null;
  onCall: (id: string) => void;
  onClear: (id: string) => void;
}) {
  if (items.length === 0)
    return (
      <div className={styles.card}>
        <p className={styles.muted}>
          Keine Follow-ups geplant. Öffne bei einem Lead „Bearbeiten&ldquo; und setze ein Follow-up-Datum — fällige Follow-ups erscheinen dann hier.
        </p>
      </div>
    );
  const now = Date.now();
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>Geplante Follow-ups</div>
      <div className={styles.leadList}>
        {items.map((l) => {
          const due = l.follow_up_at ? new Date(l.follow_up_at).getTime() <= now : false;
          return (
            <div key={l.id} className={styles.leadRow}>
              <div className={styles.leadMain}>
                <div className={styles.leadName}>
                  {l.name || l.company || l.phone}
                  <span className={styles.statusPill} data-s={due ? 'anruf' : 'bereit'}>
                    {l.follow_up_at ? new Date(l.follow_up_at).toLocaleDateString('de-DE') : ''}
                    {due ? ' · fällig' : ''}
                  </span>
                </div>
                <div className={styles.leadMeta}>
                  {l.phone}
                  {l.follow_up_note && ` · ${l.follow_up_note}`}
                </div>
              </div>
              <div className={styles.leadActions}>
                <button className={styles.callBtn} onClick={() => onCall(l.id)} disabled={busy === l.id}>
                  📞 Anrufen
                </button>
                <button className={styles.delBtn} onClick={() => onClear(l.id)} title="Follow-up erledigt">
                  ✓
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
                  {c.outcome && <span className={styles.outcomePill} data-o={c.outcome}>{OUTCOME_LABEL[c.outcome] ?? c.outcome}</span>}
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
                  {c.extracted &&
                    (c.extracted.bedarf || c.extracted.budget || c.extracted.naechster_schritt || c.extracted.entscheider != null) && (
                      <div className={styles.extractGrid}>
                        {c.extracted.bedarf && (
                          <div className={styles.extractItem}><span>Bedarf</span><strong>{c.extracted.bedarf}</strong></div>
                        )}
                        {c.extracted.budget && (
                          <div className={styles.extractItem}><span>Budget</span><strong>{c.extracted.budget}</strong></div>
                        )}
                        {c.extracted.entscheider != null && (
                          <div className={styles.extractItem}><span>Entscheider erreicht</span><strong>{c.extracted.entscheider ? 'Ja' : 'Nein'}</strong></div>
                        )}
                        {c.extracted.naechster_schritt && (
                          <div className={styles.extractItem}><span>Nächster Schritt</span><strong>{c.extracted.naechster_schritt}</strong></div>
                        )}
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
      <label className={styles.cfgField}>
        <span>Stimme</span>
        <select value={c.voice} onChange={(e) => setC({ ...c, voice: e.target.value })}>
          <option value="sarah">Sarah — weiblich, warm (Standard)</option>
          <option value="charlotte">Charlotte — weiblich, freundlich</option>
          <option value="alice">Alice — weiblich, klar</option>
          <option value="lily">Lily — weiblich, jung</option>
          <option value="george">George — männlich, ruhig</option>
          <option value="liam">Liam — männlich, sympathisch</option>
        </select>
      </label>
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

      <div className={styles.cfgHead}>Rechtliches &amp; Compliance</div>
      <p className={styles.hint}>
        Für Anrufe in Deutschland: Lina nennt sich am Anfang als KI zu erkennen (EU&nbsp;AI&nbsp;Act) und weist
        auf eine Aufzeichnung hin (§&nbsp;201&nbsp;StGB). Empfehlung: beides aktiviert lassen.
      </p>
      <label className={styles.cfgToggle}>
        <input type="checkbox" checked disabled />
        <span>
          <strong>KI-Offenlegung</strong> — Lina sagt am Gesprächsanfang, dass sie eine digitale Assistentin ist.
          {' '}<em>Gesetzlich vorgeschrieben (§&nbsp;312a&nbsp;BGB / EU&nbsp;AI&nbsp;Act) — immer aktiv, nicht abschaltbar.</em>
        </span>
      </label>
      <label className={styles.cfgToggle}>
        <input
          type="checkbox"
          checked={c.record_calls !== false}
          onChange={(e) => setC({ ...c, record_calls: e.target.checked })}
        />
        <span>
          <strong>Gespräche aufzeichnen</strong> — bei aktiver Offenlegung wird der Hinweis auf die Aufnahme automatisch ergänzt. Aus = nur Transkript, keine Audioaufnahme.
        </span>
      </label>
      {c.ai_disclosure !== false && (
        <label className={styles.cfgField}>
          <span>Eigener Offenlegungs-Text (optional — leer = Standardhinweis)</span>
          <textarea
            rows={2}
            value={c.disclosure_text ?? ''}
            onChange={(e) => setC({ ...c, disclosure_text: e.target.value })}
            placeholder="Bevor wir starten, ein kurzer Hinweis: Ich bin Lina, eine digitale Sprachassistentin…"
          />
        </label>
      )}

      <div className={styles.cfgHead}>Weiterleitung &amp; Mailbox</div>
      <p className={styles.hint}>
        Optional: Lina verbindet heiße Leads live mit einem Menschen und erkennt Anrufbeantworter.
      </p>
      <label className={styles.cfgField}>
        <span>Weiterleitungs-Nummer (Warm Transfer, im Format +49…)</span>
        <input
          value={c.transfer_number ?? ''}
          onChange={(e) => setC({ ...c, transfer_number: e.target.value })}
          placeholder="+49 151 23456789 — leer = keine Weiterleitung"
        />
      </label>
      <label className={styles.cfgToggle}>
        <input
          type="checkbox"
          checked={c.voicemail_detection !== false}
          onChange={(e) => setC({ ...c, voicemail_detection: e.target.checked })}
        />
        <span>
          <strong>Anrufbeantworter erkennen</strong> — bei Mailbox hinterlässt Lina eine kurze Nachricht statt ins Leere zu reden.
        </span>
      </label>
      {c.voicemail_detection !== false && (
        <label className={styles.cfgField}>
          <span>Mailbox-Ansage (optional — leer = Standardansage)</span>
          <textarea
            rows={2}
            value={c.voicemail_message ?? ''}
            onChange={(e) => setC({ ...c, voicemail_message: e.target.value })}
            placeholder="Hallo, hier ist Lina. Ich habe Sie leider nicht erreicht und melde mich gern noch einmal…"
          />
        </label>
      )}

      <div className={styles.cfgActions}>
        <button type="submit" disabled={saving}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        {saved && <span className={styles.savedMsg}>✓ Gespeichert</span>}
      </div>
    </form>
  );
}

const INTENSITY_LABEL: Record<string, string> = { aggressiv: 'Aggressiv', moderat: 'Moderat', konservativ: 'Konservativ' };
const CAMP_STATUS_LABEL: Record<string, string> = { entwurf: 'Entwurf', aktiv: 'Aktiv', pausiert: 'Pausiert', fertig: 'Fertig' };

function campaignPatch(id: string, body: Record<string, unknown>) {
  return fetch(`/api/sales/campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function Campaigns(p: {
  campaigns: Campaign[];
  approvedCount: number;
  busy: string | null;
  vapiReady: boolean;
  onReload: () => Promise<void>;
  setErr: (s: string) => void;
}) {
  const [name, setName] = useState('');
  const [intensity, setIntensity] = useState('moderat');
  const [ws, setWs] = useState(9);
  const [we, setWe] = useState(17);
  const [working, setWorking] = useState(false);
  const [openReport, setOpenReport] = useState<string | null>(null);

  async function act(fn: () => Promise<Response>) {
    p.setErr('');
    setWorking(true);
    try {
      const r = await fn();
      if (!r.ok) {
        p.setErr((await r.json().catch(() => ({}))).error ?? 'Fehler');
        return null;
      }
      await p.onReload();
      return r;
    } finally {
      setWorking(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await act(() =>
      fetch('/api/sales/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, intensity, window_start: ws, window_end: we }),
      }),
    );
    if (ok) setName('');
  }

  return (
    <>
      {!p.vapiReady && (
        <div className={styles.warn}>Telefonie ist noch nicht eingerichtet — Kampagnen lassen sich erst starten, wenn Vapi verbunden ist.</div>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>Neue Kampagne</div>
        <form className={styles.addForm} onSubmit={create}>
          <input placeholder="Name der Kampagne" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            <option value="aggressiv">Aggressiv (dicht nachfassen)</option>
            <option value="moderat">Moderat (Standard)</option>
            <option value="konservativ">Konservativ (sparsam)</option>
          </select>
          <input type="number" min={0} max={23} value={ws} onChange={(e) => setWs(Number(e.target.value))} title="Anruffenster von (Stunde)" />
          <input type="number" min={1} max={24} value={we} onChange={(e) => setWe(Number(e.target.value))} title="Anruffenster bis (Stunde)" />
          <button type="submit" disabled={working}>Anlegen</button>
        </form>
        <p className={styles.hint}>
          Intensität steuert, wie oft &amp; dicht Lina nachfasst. Anruffenster = erlaubte Uhrzeiten (lokal). Aktuell{' '}
          <strong>{p.approvedCount}</strong> freigegebene Leads zum Hinzufügen verfügbar.
        </p>
      </section>

      {p.campaigns.length === 0 ? (
        <div className={styles.card}>
          <p className={styles.muted}>
            Noch keine Kampagne. Lege oben eine an, füge mit „+ Leads&ldquo; deine freigegebenen Leads hinzu und starte sie — Lina arbeitet die Liste dann automatisch im Anruffenster ab.
          </p>
        </div>
      ) : (
        p.campaigns.map((c) => (
          <section key={c.id} className={styles.card}>
            <div className={styles.campHead}>
              <div>
                <div className={styles.campName}>{c.name}</div>
                <div className={styles.campMeta}>
                  <span className={styles.campStatus} data-s={c.status}>{CAMP_STATUS_LABEL[c.status] ?? c.status}</span>
                  <span>{INTENSITY_LABEL[c.intensity] ?? c.intensity}</span>
                  <span>{c.window_start}–{c.window_end} Uhr</span>
                  <span>max. {c.max_attempts} Versuche · {c.max_per_day}/Tag</span>
                </div>
              </div>
              <div className={styles.campActions}>
                {c.status !== 'aktiv' ? (
                  <button className={styles.callBtn} disabled={working || !p.vapiReady} onClick={() => act(() => campaignPatch(c.id, { status: 'aktiv' }))}>
                    ▶ Starten
                  </button>
                ) : (
                  <button className={styles.cancelBtn} disabled={working} onClick={() => act(() => campaignPatch(c.id, { status: 'pausiert' }))}>
                    ⏸ Pausieren
                  </button>
                )}
                <button className={styles.editBtn} disabled={working} title="Freigegebene Leads hinzufügen" onClick={() => act(() => fetch(`/api/sales/campaigns/${c.id}/enqueue`, { method: 'POST' }))}>
                  + Leads
                </button>
                <button className={styles.editBtn} title="Auswertung" onClick={() => setOpenReport(openReport === c.id ? null : c.id)}>
                  📊 Auswertung
                </button>
                <button className={styles.delBtn} disabled={working} title="Löschen" onClick={() => { if (confirm('Kampagne wirklich löschen?')) act(() => fetch(`/api/sales/campaigns/${c.id}`, { method: 'DELETE' })); }}>
                  🗑
                </button>
              </div>
            </div>
            <div className={styles.campStats}>
              <span><strong>{c.counts.total}</strong> Leads</span>
              <span><strong>{c.counts.offen}</strong> offen</span>
              <span><strong>{c.counts.erledigt}</strong> erledigt</span>
              <span><strong>{c.counts.gesperrt}</strong> gesperrt</span>
            </div>
            {openReport === c.id && <CampaignReport id={c.id} />}
          </section>
        ))
      )}
    </>
  );
}

interface Report {
  leadCount: number;
  calls: number;
  reached: number;
  qualified: number;
  termine: number;
  keinInteresse: number;
  minutes: number;
  avgSec: number;
  conversion: number;
  series: { day: string; count: number }[];
}

function CampaignReport({ id }: { id: string }) {
  const [r, setR] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/sales/campaigns/${id}/report`);
      if (active && res.ok) setR((await res.json()).report);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className={styles.reportBox}><p className={styles.muted}>Lade Auswertung…</p></div>;
  if (!r) return <div className={styles.reportBox}><p className={styles.muted}>Auswertung nicht verfügbar.</p></div>;

  const pct = (n: number) => (r.calls ? Math.round((n / r.calls) * 100) : 0);
  const funnel = [
    { label: 'Angerufen', n: r.calls, p: 100 },
    { label: 'Erreicht', n: r.reached, p: pct(r.reached) },
    { label: 'Qualifiziert', n: r.qualified, p: pct(r.qualified) },
    { label: 'Termine', n: r.termine, p: pct(r.termine) },
  ];
  const maxDay = Math.max(1, ...r.series.map((s) => s.count));
  const mmss = `${Math.floor(r.avgSec / 60)}:${String(r.avgSec % 60).padStart(2, '0')}`;

  return (
    <div className={styles.reportBox}>
      {r.calls === 0 ? (
        <p className={styles.muted}>Noch keine abgeschlossenen Anrufe in dieser Kampagne.</p>
      ) : (
        <>
          <div className={styles.funnel}>
            {funnel.map((f) => (
              <div key={f.label} className={styles.funnelRow}>
                <span className={styles.funnelLabel}>{f.label}</span>
                <div className={styles.funnelTrack}>
                  <div className={styles.funnelFill} style={{ width: `${Math.max(f.p, 3)}%` }} />
                </div>
                <span className={styles.funnelVal}>{f.n} · {f.p}%</span>
              </div>
            ))}
          </div>

          <div className={styles.kpiGrid}>
            <div className={styles.kpi}><span>Conversion</span><strong>{r.conversion}%</strong></div>
            <div className={styles.kpi}><span>Erreicht-Quote</span><strong>{pct(r.reached)}%</strong></div>
            <div className={styles.kpi}><span>Ø-Dauer</span><strong>{mmss}</strong></div>
            <div className={styles.kpi}><span>Minuten gesamt</span><strong>{r.minutes}</strong></div>
            <div className={styles.kpi}><span>Kein Interesse</span><strong>{r.keinInteresse}</strong></div>
            <div className={styles.kpi}><span>Leads</span><strong>{r.leadCount}</strong></div>
          </div>

          <div className={styles.sparkHead}>Anrufe (14 Tage)</div>
          <div className={styles.spark}>
            {r.series.map((s) => (
              <div key={s.day} className={styles.sparkBar} title={`${s.day}: ${s.count}`} style={{ height: `${Math.round((s.count / maxDay) * 100)}%` }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
