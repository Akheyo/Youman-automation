import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwnerEmail } from '@/lib/plans';
import { collectChecks, versandBereit, OUTREACH_TABLES, type SchemaProbe } from '@/lib/systemcheck';
import styles from './systemcheck.module.css';

export const metadata: Metadata = { title: 'Systemcheck · Youman Automation', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Systemcheck — die Seite für den Livegang.
 *
 * Zugang: solange Supabase nicht eingerichtet ist, gibt es keinen Login, mit
 * dem man sich ausweisen könnte — dann ist die Seite offen, denn genau in dem
 * Moment wird sie gebraucht. Sobald die Datenbank steht, sehen sie nur noch
 * Inhaber. Angezeigt werden ausschließlich Ja/Nein und Variablennamen, nie
 * Werte.
 */
async function probeSchema(): Promise<SchemaProbe | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const missing: string[] = [];
  for (const table of OUTREACH_TABLES) {
    const { error } = await admin.from(table).select('*', { count: 'exact', head: true }).limit(1);
    // Fehlende Tabelle meldet Postgres als 42P01 ("undefined_table").
    if (error && (error.code === '42P01' || /does not exist/i.test(error.message))) missing.push(table);
  }
  return { missing, checked: OUTREACH_TABLES.length };
}

export default async function SystemcheckPage() {
  if (supabaseConfigured()) {
    const supabase = createClient()!;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login?redirect=/systemcheck');
    if (!isOwnerEmail(user.email)) redirect('/dashboard');
  }

  const schema = await probeSchema();
  const groups = collectChecks(process.env, schema);
  const bereit = versandBereit(groups);
  const offen = groups.flatMap((g) => g.checks).filter((c) => !c.ok && c.level !== 'optional');

  return (
    <div className={styles.page}>
      <section className={bereit ? styles.heroOk : styles.hero}>
        <h1 className={styles.h1}>Systemcheck</h1>
        <p className={styles.heroSub}>
          {bereit
            ? 'Alles Nötige steht. Paul kann Kampagnen versenden.'
            : offen.length === 1
              ? 'Ein Baustein fehlt noch, dann kann die erste Mail raus.'
              : `Noch ${offen.length} Bausteine, dann kann die erste Mail raus.`}
        </p>
      </section>

      <main className={styles.main}>
        {groups.map((group) => (
          <section key={group.level} className={styles.card}>
            <h2 className={styles.cardHead}>{group.title}</h2>
            <p className={styles.sub}>{group.subtitle}</p>

            <ul className={styles.list}>
              {group.checks.map((check) => (
                <li key={check.id} className={styles.row}>
                  <span className={check.ok ? styles.dotOk : group.level === 'optional' ? styles.dotOff : styles.dotBad}>
                    {check.ok ? '✓' : group.level === 'optional' ? '–' : '!'}
                  </span>
                  <div className={styles.rowText}>
                    <span className={styles.rowLabel}>{check.label}</span>
                    <span className={styles.rowDetail}>{check.detail}</span>
                    {!check.ok && check.hint && <span className={styles.rowHint}>{check.hint}</span>}
                    {!check.ok && check.vars && check.vars.length > 0 && (
                      <span className={styles.vars}>
                        {check.vars.map((v) => (
                          <code key={v}>{v}</code>
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className={styles.card}>
          <h2 className={styles.cardHead}>Weiter</h2>
          <p className={styles.sub}>
            Die vollständige Anleitung zum Livegang steht in <code>GO-LIVE.md</code> im Projektordner, die Einrichtung des
            Versands in <code>SETUP-PAUL.md</code>.
          </p>
          <div className={styles.links}>
            <Link className={styles.primary} href="/outreach">
              Zu Paul
            </Link>
            <Link className={styles.secondary} href="/einstellungen">
              Einstellungen
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
