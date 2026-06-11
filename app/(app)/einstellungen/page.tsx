import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import { planFor } from '@/lib/plans';
import BillingButtons from '../dashboard/BillingButtons';
import styles from '../dashboard/dashboard.module.css';

export const metadata: Metadata = { title: 'Einstellungen · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function EinstellungenPage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: gt }] = await Promise.all([
    supabase.from('profiles').select('plan, subscription_status, stripe_subscription_id').eq('id', user.id).single(),
    supabase.from('google_tokens').select('email').eq('user_id', user.id).single(),
  ]);
  const plan = planFor(profile?.plan);
  const hasSub = Boolean(profile?.stripe_subscription_id);
  const googleEmail = gt?.email ?? null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Einstellungen</h1>
            <p className={styles.hello}>Konto, Kalender, Lina &amp; Abrechnung</p>
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>Konto</div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingName}>Angemeldet als</div>
              <div className={styles.settingDesc}>{user.email}</div>
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className={styles.signout}>
                Abmelden
              </button>
            </form>
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingName}>Tarif</div>
              <div className={styles.settingDesc}>
                {plan.name} — {plan.searches} Suchen · {plan.emails} Mails · {plan.calls} Anrufe / Monat
              </div>
            </div>
            <Link href="/pricing" className={styles.settingBtn}>
              Tarif ansehen
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>Integrationen</div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingName}>Google-Kalender</div>
              <div className={styles.settingDesc}>
                {googleEmail ? `Verbunden: ${googleEmail}` : 'Noch nicht verbunden — Lina kann ohne ihn keine Termine buchen.'}
              </div>
            </div>
            {googleEmail ? (
              <span className={styles.okPill}>✓ Verbunden</span>
            ) : (
              <a href="/api/google/connect" className={styles.settingBtn}>
                Verbinden
              </a>
            )}
          </div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingName}>Lina-Persönlichkeit</div>
              <div className={styles.settingDesc}>Tonfall, Stimme, Ziel &amp; Gesprächsleitfaden des Telefon-Agenten anpassen.</div>
            </div>
            <Link href="/sales" className={styles.settingBtn}>
              Bearbeiten
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>Abrechnung</div>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingName}>Zahlung &amp; Rechnungen</div>
              <div className={styles.settingDesc}>Tarif wechseln, Zahlungsdaten &amp; Rechnungen verwalten (Stripe).</div>
            </div>
            <BillingButtons hasSubscription={hasSub} planId={plan.id} />
          </div>
        </section>
      </main>
    </div>
  );
}
