'use client';

/** Shared login / signup form. Talks to Supabase Auth (email + password). */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './auth.module.css';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const isSignup = mode === 'signup';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (isSignup && !agreed) {
      setError('Bitte bestätige, dass du als Unternehmer handelst und AGB & Datenschutz akzeptierst.');
      return;
    }
    setLoading(true);
    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim(), is_business: true },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        // Email confirmation on → no session yet.
        if (!data.session) {
          setInfo('Fast geschafft! Bitte bestätige deine E-Mail über den Link, den wir dir gerade geschickt haben.');
          setLoading(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      const redirect = new URLSearchParams(window.location.search).get('redirect') || '/felix';
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <aside className={styles.panel}>
        <div className={styles.panelTop}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Youman Automation" className={styles.panelLogo} />
        </div>
        <div className={styles.panelBody}>
          <h2 className={styles.panelTitle}>
            Dein KI-Vertriebsteam,<br />das anruft &amp; Termine bucht.
          </h2>
          <ul className={styles.panelList}>
            <li>Felix findet passende Firmen</li>
            <li>Anna analysiert &amp; findet die E-Mail</li>
            <li>Paul schreibt den Pitch</li>
            <li>Lina ruft an &amp; bucht den Termin</li>
          </ul>
          <div className={styles.panelTeam}>
            {['felix', 'anna', 'paul'].map((n) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={n} src={`/team/${n}.png`} alt="" className={styles.panelAvatar} />
            ))}
            <span className={styles.panelLina}>📞</span>
            <span className={styles.panelTeamLabel}>Felix · Anna · Paul · Lina</span>
          </div>
        </div>
        <div className={styles.panelFoot}>DSGVO-konform · Server in Deutschland · auf Deutsch</div>
      </aside>

      <div className={styles.formCol}>
        <div className={styles.card}>
          <div className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Youman Automation" className={styles.logoImg} />
          </div>
          <h1 className={styles.title}>{isSignup ? 'Konto erstellen' : 'Willkommen zurück'}</h1>
        <p className={styles.sub}>
          {isSignup ? 'Starte mit Felix, Anna & Paul – deinem KI-Vertriebsteam.' : 'Melde dich an, um fortzufahren.'}
        </p>

        <form onSubmit={submit} className={styles.form}>
          {isSignup && (
            <label className={styles.field}>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann" autoComplete="name" />
            </label>
          )}
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
          <label className={styles.field}>
            <span>Passwort</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </label>

          {!isSignup && (
            <div className={styles.forgot}>
              <Link href="/passwort-vergessen">Passwort vergessen?</Link>
            </div>
          )}

          {isSignup && (
            <label className={styles.consent}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                Ich handle als <strong>Unternehmer</strong> (§&nbsp;14&nbsp;BGB) und akzeptiere die{' '}
                <Link href="/agb" target="_blank">AGB</Link> und{' '}
                <Link href="/datenschutz" target="_blank">Datenschutzerklärung</Link>.
              </span>
            </label>
          )}

          {error && <div className={styles.error}>{error}</div>}
          {info && <div className={styles.info}>{info}</div>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Bitte warten…' : isSignup ? 'Konto erstellen' : 'Anmelden'}
          </button>
        </form>

        <div className={styles.switch}>
          {isSignup ? (
            <>
              Schon ein Konto? <Link href="/login">Anmelden</Link>
            </>
          ) : (
            <>
              Noch kein Konto? <Link href="/signup">Jetzt registrieren</Link>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

/** Friendly German messages for the most common Supabase auth errors. */
function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-Mail oder Passwort ist falsch.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Diese E-Mail ist bereits registriert. Bitte melde dich an.';
  if (m.includes('password should be')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if (m.includes('rate limit')) return 'Zu viele Versuche – bitte kurz warten.';
  return msg;
}
