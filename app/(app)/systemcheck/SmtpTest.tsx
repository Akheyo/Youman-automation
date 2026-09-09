'use client';

import { useState } from 'react';
import styles from './systemcheck.module.css';

/**
 * Prüft die SMTP-Anmeldung auf Knopfdruck, ohne eine Mail zu verschicken.
 * Beim Einrichten scheitert es fast immer an denselben zwei Dingen: falscher
 * Port oder Kontopasswort statt App-Passwort. Beides sagt der Test direkt.
 */
export default function SmtpTest() {
  const [state, setState] = useState<'bereit' | 'laeuft' | 'ok' | 'fehler'>('bereit');
  const [message, setMessage] = useState('');

  async function testen() {
    setState('laeuft');
    setMessage('');
    try {
      const res = await fetch('/api/outreach/smtp-test', { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; error?: string; host?: string; port?: number };
      if (data.ok) {
        setState('ok');
        setMessage(`Anmeldung am Postfach hat geklappt (${data.host}:${data.port}).`);
      } else {
        setState('fehler');
        setMessage(data.error ?? 'Unbekannter Fehler.');
      }
    } catch (e) {
      setState('fehler');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className={styles.smtpTest}>
      <button className={styles.secondary} onClick={testen} disabled={state === 'laeuft'}>
        {state === 'laeuft' ? 'Verbinde …' : 'SMTP-Verbindung testen'}
      </button>
      {message && <p className={state === 'ok' ? styles.testOk : styles.testBad}>{message}</p>}
    </div>
  );
}
