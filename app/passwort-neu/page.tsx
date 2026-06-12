'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from '../login/auth.module.css';

export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError('Login ist gerade nicht verfügbar.');
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes('password should be')) setError('Das Passwort muss mindestens 6 Zeichen haben.');
      else if (m.includes('session') || m.includes('jwt') || m.includes('auth'))
        setError('Der Link ist abgelaufen. Bitte fordere einen neuen an.');
      else setError('Etwas ist schiefgelaufen. Bitte versuche es erneut.');
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => {
      router.push('/felix');
      router.refresh();
    }, 1500);
  }

  return (
    <div className={styles.simpleWrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Neues Passwort</h1>
        {done ? (
          <p className={styles.sub}>
            ✅ Passwort gespeichert. Du wirst weitergeleitet…
          </p>
        ) : (
          <>
            <p className={styles.sub}>Vergib ein neues Passwort für dein Konto.</p>
            <form onSubmit={submit} className={styles.form}>
              <label className={styles.field}>
                <span>Neues Passwort</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  autoComplete="new-password"
                />
              </label>
              <label className={styles.field}>
                <span>Passwort bestätigen</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Passwort wiederholen"
                  autoComplete="new-password"
                />
              </label>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.submit} disabled={loading}>
                {loading ? 'Bitte warten…' : 'Passwort speichern'}
              </button>
            </form>
            <div className={styles.switch}>
              <Link href="/passwort-vergessen">Neuen Link anfordern</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
