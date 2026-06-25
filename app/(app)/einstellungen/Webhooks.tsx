'use client';

import { useEffect, useState } from 'react';
import styles from '../dashboard/dashboard.module.css';

export default function Webhooks() {
  const [token, setToken] = useState<string | null>(null);
  const [ingestUrl, setIngestUrl] = useState<string | null>(null);
  const [postCallUrl, setPostCallUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/sales/integrations');
    if (r.ok) {
      const d = await r.json();
      setToken(d.token);
      setIngestUrl(d.ingestUrl);
      setPostCallUrl(d.postCallUrl ?? '');
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function put(body: Record<string, unknown>) {
    setBusy(true);
    setMsg('');
    const r = await fetch('/api/sales/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      const d = await r.json();
      setToken(d.token);
      setIngestUrl(d.ingestUrl);
      setPostCallUrl(d.postCallUrl ?? '');
      setMsg('✓ Gespeichert');
    } else {
      setMsg((await r.json().catch(() => ({}))).error ?? 'Fehler');
    }
    setBusy(false);
  }

  if (loading) return null;

  return (
    <section className={styles.card}>
      <div className={styles.sectionTitle}>Webhooks &amp; Integrationen</div>

      <div className={styles.settingName}>Lead-Eingang (eingehender Webhook)</div>
      <div className={styles.settingDesc}>
        Externe Systeme (CRM, Meta-Lead-Ad, Zapier, n8n) schicken Leads per <strong>POST</strong> an diese URL — sie landen
        sofort in Linas Queue. Pflichtfeld im Body: <code>phone</code>. Optional: <code>name, company, email, website, anlass,
        campaign_id, approved</code>.
      </div>
      {ingestUrl ? <div className={styles.webhookUrl}>{ingestUrl}</div> : <div className={styles.settingDesc}>Noch kein Token erzeugt.</div>}
      <div className={styles.webhookActions}>
        {ingestUrl && (
          <button type="button" className={styles.signout} onClick={() => navigator.clipboard?.writeText(ingestUrl)}>
            URL kopieren
          </button>
        )}
        <button type="button" className={styles.settingBtn} disabled={busy} onClick={() => put({ action: 'regenerate_token' })}>
          {token ? 'Token neu erzeugen' : 'Token erzeugen'}
        </button>
      </div>

      <div className={styles.settingName} style={{ marginTop: 22 }}>Ergebnis-Webhook (nach jedem Anruf)</div>
      <div className={styles.settingDesc}>
        Nach jedem Anruf senden wir das Ergebnis als JSON dorthin (Ergebnis, Zusammenfassung, extrahierte Variablen,
        Aufnahme-Link). Ideal für n8n/Make/Zapier oder dein CRM.
      </div>
      <div className={styles.webhookActions}>
        <input
          className={styles.webhookInput}
          value={postCallUrl}
          onChange={(e) => setPostCallUrl(e.target.value)}
          placeholder="https://…/webhook (leer = aus)"
        />
        <button type="button" className={styles.settingBtn} disabled={busy} onClick={() => put({ post_call_webhook_url: postCallUrl })}>
          Speichern
        </button>
      </div>
      {msg && <div className={styles.settingDesc}>{msg}</div>}
    </section>
  );
}
