'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from '../login/auth.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError('Login ist gerade nicht verfügbar.');
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/passwort-neu`,
    });
    if (error && !error.message.toLowerCase().includes('rate')) {
      setError('Etwas ist schiefgelaufen. Bitte versuche es erneut.');
      setLoading(false);
      return;
    }
    // Always show success (don't reveal whether the e-mail exists).
    setSent(true);
    setLoading(false);
  }

  return (
    <div className={styles.simpleWrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Passwort zurücksetzen</h1>
        {sent ? (
          <>
            <p className={styles.sub}>
              Wenn ein Konto zu <strong>{email}</strong> existiert, haben wir dir einen Link
              zum Zurücksetzen geschickt. Schau auch im Spam-Ordner nach.
            </p>
            <div className={styles.switch}>
              <Link href="/login">← Zurück zur Anmeldung</Link>
            </div>
          </>
        ) : (
          <>
            <p className={styles.sub}>
              Gib deine E-Mail-Adresse ein – wir schicken dir einen Link, um ein neues Passwort
              zu vergeben.
            </p>
            <form onSubmit={submit} className={styles.form}>
              <label className={styles.field}>
                <span>E-Mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="du@firma.de"
                  autoComplete="email"
                />
              </label>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.submit} disabled={loading}>
                {loading ? 'Bitte warten…' : 'Link senden'}
              </button>
            </form>
            <div className={styles.switch}>
              <Link href="/login">← Zurück zur Anmeldung</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
