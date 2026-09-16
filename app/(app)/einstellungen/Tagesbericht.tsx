'use client';

import { useEffect, useState } from 'react';
import styles from '../dashboard/dashboard.module.css';

/**
 * Schalter für den abendlichen Tagesbericht. Standard an; wer ihn nicht will,
 * schaltet ihn hier aus. Der Bericht schweigt ohnehin, wenn nichts passiert ist.
 */
export default function Tagesbericht() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/tagesbericht')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setEnabled(d.enabled);
          setEmail(d.email);
        }
      })
      .catch(() => setEnabled(true));
  }, []);

  async function toggle() {
    if (enabled === null) return;
    setBusy(true);
    const r = await fetch('/api/tagesbericht', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (r.ok) setEnabled((await r.json()).enabled);
    setBusy(false);
  }

  if (enabled === null) return null;

  return (
    <div className={styles.settingRow}>
      <div>
        <div className={styles.settingName}>Tagesbericht von Paul</div>
        <div className={styles.settingDesc}>
          Jeden Abend eine Mail{email ? ` an ${email}` : ''}: wer geöffnet, wer geantwortet, wer sich abgemeldet hat — namentlich —
          plus Versand, Fehler und Stand des Schutzschalters. Kommt nur, wenn etwas passiert ist.
        </div>
      </div>
      <button type="button" className={enabled ? styles.okPill : styles.settingBtn} disabled={busy} onClick={toggle}>
        {enabled ? '✓ An' : 'Einschalten'}
      </button>
    </div>
  );
}
