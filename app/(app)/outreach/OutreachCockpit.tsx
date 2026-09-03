'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './outreach.module.css';

/**
 * Paul — das Cockpit für Cold-Outreach per E-Mail.
 *
 * Eine Kampagne ist eine Sequenz (Erstmail + Follow-ups), die pro Kontakt
 * abgearbeitet wird, bis er antwortet, sich abmeldet oder durch ist. Die fünf
 * Reiter folgen genau dieser Reihenfolge: anlegen → texten → Kontakte rein →
 * laufen lassen → nachsehen, was passiert ist.
 */

interface Counts {
  total: number;
  offen: number;
  geantwortet: number;
  abgemeldet: number;
  fertig: number;
  gesendet: number;
}
interface Campaign {
  id: string;
  name: string;
  status: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  signature: string | null;
  window_start: number;
  window_end: number;
  send_on_weekend: boolean;
  max_per_day: number;
  stop_on_reply: boolean;
  counts: Counts;
}
interface Step {
  step_no?: number;
  delay_days: number;
  subject: string;
  body: string;
}
interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  website: string | null;
  anlass: string | null;
  status: string;
  current_step: number;
  next_send_at: string | null;
  last_sent_at: string | null;
  last_error: string | null;
}
interface PreviewStep {
  step_no: number;
  delay_days: number;
  subject: string;
  body: string;
  missing: string[];
}
interface Report {
  total: number;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
  perStep: { step_no: number; count: number }[];
  quoten: { antwortquote: number; abmeldequote: number };
  recent: { created_at: string; kind: string; step_no: number | null; subject: string | null; detail: string | null }[];
}
interface Suppressed {
  email: string;
  reason: string;
  created_at: string;
}

type Tab = 'kampagnen' | 'sequenz' | 'kontakte' | 'bericht' | 'sperrliste';

const TABS: { id: Tab; label: string }[] = [
  { id: 'kampagnen', label: 'Kampagnen' },
  { id: 'sequenz', label: 'Sequenz' },
  { id: 'kontakte', label: 'Kontakte' },
  { id: 'bericht', label: 'Bericht' },
  { id: 'sperrliste', label: 'Sperrliste' },
];

const STATUS_TEXT: Record<string, string> = {
  neu: 'noch nicht angeschrieben',
  aktiv: 'Sequenz läuft',
  geantwortet: 'hat geantwortet',
  fertig: 'Sequenz durch',
  gestoppt: 'angehalten',
  abgemeldet: 'abgemeldet',
  bounce: 'unzustellbar',
};

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function OutreachCockpit(props: {
  email: string;
  ownerName: string;
  planName: string;
  mailsUsed: number;
  mailsLimit: number;
  senderReady: boolean;
}) {
  const [tab, setTab] = useState<Tab>('kampagnen');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [suppressed, setSuppressed] = useState<Suppressed[]>([]);
  const [preview, setPreview] = useState<PreviewStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const active = useMemo(() => campaigns.find((c) => c.id === activeId) ?? null, [campaigns, activeId]);

  const say = (message: string) => {
    setInfo(message);
    setErr(null);
    setTimeout(() => setInfo(null), 6000);
  };

  async function call<T>(url: string, init?: RequestInit): Promise<T | null> {
    setErr(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErr(String(data.error ?? `Fehler ${res.status}`));
        return null;
      }
      return data as T;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  const loadCampaigns = useCallback(async () => {
    const data = await call<{ campaigns: Campaign[] }>('/api/outreach/campaigns');
    if (!data) return;
    setCampaigns(data.campaigns);
    setActiveId((cur) => cur ?? data.campaigns[0]?.id ?? null);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const data = await call<{ steps: Step[] }>(`/api/outreach/campaigns/${id}`);
    if (data) setSteps(data.steps.length ? data.steps : [{ delay_days: 0, subject: '', body: '' }]);
  }, []);

  const loadContacts = useCallback(async (id: string) => {
    const data = await call<{ contacts: Contact[] }>(`/api/outreach/campaigns/${id}/contacts`);
    if (data) setContacts(data.contacts);
  }, []);

  const loadReport = useCallback(async (id: string) => {
    const data = await call<Report>(`/api/outreach/campaigns/${id}/report`);
    if (data) setReport(data);
  }, []);

  const loadSuppression = useCallback(async () => {
    const data = await call<{ entries: Suppressed[] }>('/api/outreach/suppression');
    if (data) setSuppressed(data.entries);
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!activeId) return;
    void loadDetail(activeId);
    void loadContacts(activeId);
  }, [activeId, loadDetail, loadContacts]);

  useEffect(() => {
    if (tab === 'bericht' && activeId) void loadReport(activeId);
    if (tab === 'sperrliste') void loadSuppression();
  }, [tab, activeId, loadReport, loadSuppression]);

  // ---- Kampagnen ----------------------------------------------------------
  const [newName, setNewName] = useState('');

  async function createCampaign() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const data = await call<{ campaign: Campaign }>('/api/outreach/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name, from_name: props.ownerName || undefined, from_email: props.email }),
    });
    setBusy(false);
    if (data) {
      setNewName('');
      setActiveId(data.campaign.id);
      await loadCampaigns();
      say('Kampagne angelegt — die Startsequenz steht im Reiter „Sequenz“ zum Überschreiben bereit.');
      setTab('sequenz');
    }
  }

  async function patchCampaign(id: string, patch: Record<string, unknown>, note?: string) {
    setBusy(true);
    const data = await call<{ campaign: Campaign; scheduled?: number }>(`/api/outreach/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (data) {
      await loadCampaigns();
      if (note) say(data.scheduled ? `${note} ${data.scheduled} Kontakte sind eingeplant.` : note);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Kampagne mit allen Kontakten und dem Versandprotokoll löschen?')) return;
    setBusy(true);
    const ok = await call(`/api/outreach/campaigns/${id}`, { method: 'DELETE' });
    setBusy(false);
    if (ok) {
      setActiveId(null);
      await loadCampaigns();
    }
  }

  // ---- Sequenz ------------------------------------------------------------
  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((cur) => [...cur, { delay_days: 3, subject: '', body: '' }]);
  }
  function removeStep(i: number) {
    setSteps((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur));
  }

  async function saveSteps() {
    if (!activeId) return;
    setBusy(true);
    const data = await call(`/api/outreach/campaigns/${activeId}/steps`, {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    });
    setBusy(false);
    if (data) say('Sequenz gespeichert.');
  }

  async function loadPreview() {
    if (!activeId) return;
    setBusy(true);
    const data = await call<{ steps: PreviewStep[] }>(`/api/outreach/campaigns/${activeId}/preview`, {
      method: 'POST',
      body: JSON.stringify({ steps }),
    });
    setBusy(false);
    if (data) setPreview(data.steps);
  }

  // ---- Kontakte -----------------------------------------------------------
  const [csv, setCsv] = useState('');

  async function importCsv() {
    if (!activeId || !csv.trim()) return;
    setBusy(true);
    const data = await call<{ imported: number; skippedBlocked: number; skippedDuplicate: number }>(
      `/api/outreach/campaigns/${activeId}/contacts`,
      { method: 'POST', body: JSON.stringify({ csv }) },
    );
    setBusy(false);
    if (data) {
      setCsv('');
      await Promise.all([loadContacts(activeId), loadCampaigns()]);
      const skipped = [
        data.skippedBlocked ? `${data.skippedBlocked} auf der Sperrliste` : '',
        data.skippedDuplicate ? `${data.skippedDuplicate} schon vorhanden` : '',
      ].filter(Boolean);
      say(`${data.imported} Kontakte übernommen${skipped.length ? ` — übersprungen: ${skipped.join(', ')}.` : '.'}`);
    }
  }

  async function importFromLeads() {
    if (!activeId) return;
    setBusy(true);
    const data = await call<{ imported: number; skippedBlocked: number; skippedDuplicate: number }>(
      `/api/outreach/campaigns/${activeId}/contacts`,
      { method: 'POST', body: JSON.stringify({ fromLeads: true }) },
    );
    setBusy(false);
    if (data) {
      await Promise.all([loadContacts(activeId), loadCampaigns()]);
      say(`${data.imported} Leads mit E-Mail-Adresse übernommen.`);
    }
  }

  async function contactAction(id: string, action: string) {
    setBusy(true);
    const data = await call(`/api/outreach/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
    setBusy(false);
    if (data && activeId) await Promise.all([loadContacts(activeId), loadCampaigns()]);
  }

  async function sendNow(contactId: string) {
    if (!activeId) return;
    setBusy(true);
    const data = await call<{ step: number; subject: string }>(`/api/outreach/campaigns/${activeId}/send-now`, {
      method: 'POST',
      body: JSON.stringify({ contact_id: contactId }),
    });
    setBusy(false);
    if (data) {
      await Promise.all([loadContacts(activeId), loadCampaigns()]);
      say(`Schritt ${data.step} ist raus: „${data.subject}“`);
    }
  }

  // ---- Sperrliste ---------------------------------------------------------
  const [blockInput, setBlockInput] = useState('');

  async function addSuppression() {
    const emails = blockInput.split(/[\s,;]+/).filter(Boolean);
    if (emails.length === 0) return;
    setBusy(true);
    const data = await call<{ added: number; stopped: number }>('/api/outreach/suppression', {
      method: 'POST',
      body: JSON.stringify({ emails }),
    });
    setBusy(false);
    if (data) {
      setBlockInput('');
      await loadSuppression();
      say(`${data.added} Adressen gesperrt${data.stopped ? `, ${data.stopped} laufende Sequenzen gestoppt` : ''}.`);
    }
  }

  async function removeSuppression(email: string) {
    setBusy(true);
    await call(`/api/outreach/suppression?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
    setBusy(false);
    await loadSuppression();
  }

  const quotaPct = props.mailsLimit > 0 ? Math.min(100, Math.round((props.mailsUsed / props.mailsLimit) * 100)) : 0;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.h1}>Paul — Cold-Outreach</h1>
          <p className={styles.heroSub}>
            Sequenzen schreiben, Kontakte einspielen, laufen lassen. Paul verschickt die Erstmail und fasst automatisch nach —
            und hört sofort auf, sobald jemand antwortet oder sich abmeldet.
          </p>
        </div>
        <div className={styles.quota}>
          <span className={styles.quotaVal}>
            {props.mailsUsed} / {props.mailsLimit}
          </span>
          <span className={styles.quotaLabel}>Mails im Monat · Tarif {props.planName}</span>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${quotaPct}%` }} />
          </div>
        </div>
      </section>

      {!props.senderReady && (
        <div className={styles.warn}>
          Der Versandweg fehlt noch: <code>OUTREACH_WEBHOOK_URL</code> auf einen Webhook setzen, der die Mail per SMTP zustellt.
          Texten, Kontakte importieren und Vorschau gehen auch ohne — verschickt wird erst mit dieser Variable.
        </div>
      )}

      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? styles.tabActive : styles.tab} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        {err && <div className={styles.err}>{err}</div>}
        {info && <div className={styles.ok}>{info}</div>}

        {campaigns.length > 1 && tab !== 'kampagnen' && tab !== 'sperrliste' && (
          <div className={styles.picker}>
            <label htmlFor="kampagne">Kampagne</label>
            <select id="kampagne" value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value)}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {tab === 'kampagnen' && (
          <>
            <div className={styles.card}>
              <h2 className={styles.cardHead}>Neue Kampagne</h2>
              <div className={styles.addForm}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z. B. Handwerksbetriebe Münsterland"
                  onKeyDown={(e) => e.key === 'Enter' && createCampaign()}
                />
                <button onClick={createCampaign} disabled={busy || !newName.trim()}>
                  Anlegen
                </button>
              </div>
              <p className={styles.hint}>
                Jede neue Kampagne startet mit einer dreiteiligen Sequenz als Entwurf: Erstmail, Erinnerung nach drei Tagen,
                Abschluss nach sechs. Alles überschreibbar.
              </p>
            </div>

            {campaigns.length === 0 && <p className={styles.muted}>Noch keine Kampagne. Oben eine anlegen.</p>}

            {campaigns.map((c) => (
              <div key={c.id} className={c.id === activeId ? styles.campActive : styles.camp}>
                <div className={styles.campHead}>
                  <button className={styles.campName} onClick={() => setActiveId(c.id)}>
                    {c.name}
                  </button>
                  <span className={styles.statusPill} data-s={c.status}>
                    {c.status}
                  </span>
                </div>

                <div className={styles.campStats}>
                  <span>
                    <strong>{c.counts.total}</strong> Kontakte
                  </span>
                  <span>
                    <strong>{c.counts.offen}</strong> offen
                  </span>
                  <span>
                    <strong>{c.counts.gesendet}</strong> Mails raus
                  </span>
                  <span>
                    <strong>{c.counts.geantwortet}</strong> Antworten
                  </span>
                  <span>
                    <strong>{c.counts.abgemeldet}</strong> abgemeldet
                  </span>
                </div>

                <div className={styles.settings}>
                  <label>
                    Absendername
                    <input
                      defaultValue={c.from_name ?? ''}
                      onBlur={(e) => e.target.value !== (c.from_name ?? '') && patchCampaign(c.id, { from_name: e.target.value })}
                    />
                  </label>
                  <label>
                    Absenderadresse
                    <input
                      type="email"
                      defaultValue={c.from_email ?? ''}
                      onBlur={(e) => e.target.value !== (c.from_email ?? '') && patchCampaign(c.id, { from_email: e.target.value })}
                    />
                  </label>
                  <label>
                    Versand ab
                    <input
                      type="number"
                      min={0}
                      max={23}
                      defaultValue={c.window_start}
                      onBlur={(e) => patchCampaign(c.id, { window_start: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Versand bis
                    <input
                      type="number"
                      min={1}
                      max={24}
                      defaultValue={c.window_end}
                      onBlur={(e) => patchCampaign(c.id, { window_end: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Mails pro Tag
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={c.max_per_day}
                      onBlur={(e) => patchCampaign(c.id, { max_per_day: Number(e.target.value) })}
                    />
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      defaultChecked={c.send_on_weekend}
                      onChange={(e) => patchCampaign(c.id, { send_on_weekend: e.target.checked })}
                    />
                    auch am Wochenende
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      defaultChecked={c.stop_on_reply}
                      onChange={(e) => patchCampaign(c.id, { stop_on_reply: e.target.checked })}
                    />
                    Antwort stoppt die Sequenz
                  </label>
                </div>

                <label className={styles.sigLabel}>
                  Signatur (kommt unter jede Mail)
                  <textarea
                    rows={3}
                    defaultValue={c.signature ?? ''}
                    placeholder={'Max Muster\nYouman Automation\n0251 1234567'}
                    onBlur={(e) => e.target.value !== (c.signature ?? '') && patchCampaign(c.id, { signature: e.target.value })}
                  />
                </label>

                <div className={styles.campActions}>
                  {c.status !== 'aktiv' ? (
                    <button
                      className={styles.primary}
                      disabled={busy}
                      onClick={() => patchCampaign(c.id, { status: 'aktiv' }, 'Kampagne läuft.')}
                    >
                      Versand starten
                    </button>
                  ) : (
                    <button
                      className={styles.secondary}
                      disabled={busy}
                      onClick={() => patchCampaign(c.id, { status: 'pausiert' }, 'Kampagne pausiert.')}
                    >
                      Pausieren
                    </button>
                  )}
                  <button className={styles.del} disabled={busy} onClick={() => deleteCampaign(c.id)}>
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {tab === 'sequenz' && !active && <p className={styles.muted}>Erst eine Kampagne anlegen.</p>}
        {tab === 'sequenz' && active && (
          <>
            <div className={styles.card}>
              <h2 className={styles.cardHead}>Platzhalter</h2>
              <p className={styles.hint}>
                <code>{'{{vorname}}'}</code> <code>{'{{firma}}'}</code> <code>{'{{anlass}}'}</code> <code>{'{{website}}'}</code>{' '}
                <code>{'{{domain}}'}</code> — dazu jede eigene CSV-Spalte unter ihrem Namen. Mit Ersatzwert schreiben Sie{' '}
                <code>{'{{vorname|zusammen}}'}</code>: fehlt der Vorname, steht dort „zusammen“. Ohne Ersatzwert hält Paul die Mail
                an, statt „Hallo ,“ zu verschicken.
              </p>
            </div>

            {steps.map((s, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.stepHead}>
                  <h3 className={styles.cardHead}>{i === 0 ? 'Erstmail' : `Follow-up ${i}`}</h3>
                  {i > 0 && (
                    <label className={styles.delay}>
                      nach
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={s.delay_days}
                        onChange={(e) => updateStep(i, { delay_days: Number(e.target.value) })}
                      />
                      Tagen
                    </label>
                  )}
                  {steps.length > 1 && (
                    <button className={styles.del} onClick={() => removeStep(i)}>
                      Schritt entfernen
                    </button>
                  )}
                </div>
                <input
                  className={styles.subject}
                  value={s.subject}
                  onChange={(e) => updateStep(i, { subject: e.target.value })}
                  placeholder={i === 0 ? 'Betreff (Pflicht)' : 'Betreff leer lassen = Antwort im selben Verlauf („Re: …“)'}
                />
                <textarea
                  className={styles.body}
                  rows={10}
                  value={s.body}
                  onChange={(e) => updateStep(i, { body: e.target.value })}
                  placeholder="Text der Mail …"
                />
              </div>
            ))}

            <div className={styles.rowActions}>
              <button className={styles.secondary} onClick={addStep}>
                Follow-up ergänzen
              </button>
              <button className={styles.secondary} onClick={loadPreview} disabled={busy}>
                Vorschau
              </button>
              <button className={styles.primary} onClick={saveSteps} disabled={busy}>
                Sequenz speichern
              </button>
            </div>

            {preview && (
              <div className={styles.card}>
                <h2 className={styles.cardHead}>Vorschau am Beispielkontakt</h2>
                {preview.map((p) => (
                  <div key={p.step_no} className={styles.previewStep}>
                    <div className={styles.previewMeta}>
                      Schritt {p.step_no} · {p.delay_days === 0 ? 'sofort' : `nach ${p.delay_days} Tagen`}
                    </div>
                    <div className={styles.previewSubject}>{p.subject || '(kein Betreff)'}</div>
                    <pre className={styles.previewBody}>{p.body}</pre>
                    {p.missing.length > 0 && (
                      <div className={styles.err}>
                        Ohne Wert und ohne Ersatzwert: {p.missing.join(', ')} — solche Kontakte hält Paul an, statt sie
                        anzuschreiben.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {tab === 'kontakte' && !active && <p className={styles.muted}>Erst eine Kampagne anlegen.</p>}
        {tab === 'kontakte' && active && (
          <>
            <div className={styles.card}>
              <h2 className={styles.cardHead}>Kontakte einspielen</h2>
              <p className={styles.hint}>
                CSV mit Kopfzeile, Komma oder Semikolon. Erkannt werden <code>email</code>, <code>vorname</code>,{' '}
                <code>nachname</code>, <code>name</code>, <code>firma</code>, <code>website</code>, <code>anlass</code>. Jede
                weitere Spalte wird als eigener Platzhalter nutzbar. Adressen auf der Sperrliste werden automatisch übersprungen.
              </p>
              <textarea
                className={styles.csv}
                rows={6}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={'email;vorname;firma;anlass\nanna@beispiel.de;Anna;Beispiel GmbH;Website ohne Terminbuchung'}
              />
              <div className={styles.rowActions}>
                <label className={styles.fileBtn}>
                  Datei wählen
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setCsv(await file.text());
                    }}
                  />
                </label>
                <button className={styles.secondary} onClick={importFromLeads} disabled={busy}>
                  Aus Felix-Leads übernehmen
                </button>
                <button className={styles.primary} onClick={importCsv} disabled={busy || !csv.trim()}>
                  Importieren
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHead}>{contacts.length} Kontakte</h2>
              {contacts.length === 0 && <p className={styles.muted}>Noch keine Kontakte in dieser Kampagne.</p>}
              <ul className={styles.contactList}>
                {contacts.map((c) => (
                  <li key={c.id} className={styles.contactRow}>
                    <div className={styles.contactMain}>
                      <span className={styles.contactName}>
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                      </span>
                      <span className={styles.contactCo}>
                        {c.company ? `${c.company} · ` : ''}
                        {c.email}
                      </span>
                      <span className={styles.contactMeta}>
                        Schritt {c.current_step} · {STATUS_TEXT[c.status] ?? c.status}
                        {c.next_send_at ? ` · nächste Mail ${fmt(c.next_send_at)}` : ''}
                        {c.last_error ? ` · ${c.last_error}` : ''}
                      </span>
                    </div>
                    <div className={styles.contactActions}>
                      <span className={styles.statusPill} data-s={c.status}>
                        {c.status}
                      </span>
                      {(c.status === 'neu' || c.status === 'aktiv') && (
                        <>
                          <button className={styles.mini} disabled={busy || !props.senderReady} onClick={() => sendNow(c.id)}>
                            Jetzt senden
                          </button>
                          <button className={styles.mini} disabled={busy} onClick={() => contactAction(c.id, 'stoppen')}>
                            Anhalten
                          </button>
                        </>
                      )}
                      {(c.status === 'gestoppt' || c.status === 'fertig') && (
                        <button className={styles.mini} disabled={busy} onClick={() => contactAction(c.id, 'fortsetzen')}>
                          Fortsetzen
                        </button>
                      )}
                      {c.status !== 'geantwortet' && c.status !== 'abgemeldet' && (
                        <button className={styles.mini} disabled={busy} onClick={() => contactAction(c.id, 'geantwortet')}>
                          Hat geantwortet
                        </button>
                      )}
                      <button className={styles.del} disabled={busy} onClick={() => contactAction(c.id, 'sperren')}>
                        Sperren
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {tab === 'bericht' && !report && <p className={styles.muted}>Noch keine Zahlen.</p>}
        {tab === 'bericht' && report && (
          <>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <span className={styles.statVal}>{report.byKind.gesendet ?? 0}</span>
                <span className={styles.statLabel}>Mails versendet</span>
              </div>
              <div className={styles.statAccent}>
                <span className={styles.statVal}>{report.quoten.antwortquote}%</span>
                <span className={styles.statLabel}>Antwortquote</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statVal}>{report.byKind.geantwortet ?? 0}</span>
                <span className={styles.statLabel}>Antworten</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statVal}>{report.quoten.abmeldequote}%</span>
                <span className={styles.statLabel}>Abmeldequote</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statVal}>{report.byKind.fehler ?? 0}</span>
                <span className={styles.statLabel}>Fehler</span>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHead}>Versand je Schritt</h2>
              {report.perStep.length === 0 && <p className={styles.muted}>Noch nichts verschickt.</p>}
              {report.perStep.map((s) => (
                <div key={s.step_no} className={styles.stepBar}>
                  <span>{s.step_no === 1 ? 'Erstmail' : `Follow-up ${s.step_no - 1}`}</span>
                  <div className={styles.bar}>
                    <div
                      className={styles.fill}
                      style={{ width: `${Math.round((s.count / Math.max(1, report.perStep[0]?.count ?? 1)) * 100)}%` }}
                    />
                  </div>
                  <strong>{s.count}</strong>
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHead}>Letzte Ereignisse</h2>
              <ul className={styles.eventList}>
                {report.recent.map((e, i) => (
                  <li key={i}>
                    <span className={styles.statusPill} data-s={e.kind}>
                      {e.kind}
                    </span>
                    <span className={styles.eventText}>
                      {e.subject || e.detail || (e.step_no ? `Schritt ${e.step_no}` : '')}
                    </span>
                    <span className={styles.muted}>{fmt(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {tab === 'sperrliste' && (
          <>
            <div className={styles.card}>
              <h2 className={styles.cardHead}>Sperrliste</h2>
              <p className={styles.hint}>
                Wer hier steht, bekommt aus keiner Kampagne mehr Post — auch nicht nach einem erneuten Import. Abmeldungen über
                den Link in der Mail und harte Bounces landen automatisch hier.
              </p>
              <div className={styles.addForm}>
                <input
                  value={blockInput}
                  onChange={(e) => setBlockInput(e.target.value)}
                  placeholder="adresse@firma.de, weitere@firma.de"
                />
                <button onClick={addSuppression} disabled={busy || !blockInput.trim()}>
                  Sperren
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardHead}>{suppressed.length} gesperrte Adressen</h2>
              <ul className={styles.contactList}>
                {suppressed.map((s) => (
                  <li key={s.email} className={styles.contactRow}>
                    <div className={styles.contactMain}>
                      <span className={styles.contactName}>{s.email}</span>
                      <span className={styles.contactMeta}>
                        {s.reason} · {fmt(s.created_at)}
                      </span>
                    </div>
                    <button className={styles.mini} disabled={busy} onClick={() => removeSuppression(s.email)}>
                      Freigeben
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
