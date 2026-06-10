import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { planFor } from '@/lib/plans';
import BillingButtons from './BillingButtons';
import styles from './dashboard.module.css';

export const metadata: Metadata = { title: 'Dashboard · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Open mode (Supabase off): no accounts — send to the app.
  if (!supabaseConfigured()) redirect('/felix');

  const supabase = createClient()!;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const plan = planFor(profile?.plan);
  const searchUsed = profile?.search_count ?? 0;
  const emailUsed = profile?.email_count ?? 0;
  const hasSub = Boolean(profile?.stripe_subscription_id);
  const status = profile?.subscription_status as string | null;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link href="/felix" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Youman Automation" className={styles.logoImg} />
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.signout}>
            Abmelden
          </button>
        </form>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.hello}>Angemeldet als {user.email}</p>

        <section className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <div className={styles.label}>Dein Tarif</div>
              <div className={styles.planName}>
                {plan.name} {status && status !== 'active' && <span className={styles.status}>({status})</span>}
              </div>
            </div>
            <Link href="/felix" className={styles.appLink}>
              Zu Felix →
            </Link>
          </div>

          <Usage label="Firmensuchen" used={searchUsed} limit={plan.searches} />
          <Usage label="Pitch-Mails" used={emailUsed} limit={plan.emails} />
          <div className={styles.reset}>Zähler werden zu Monatsbeginn zurückgesetzt.</div>
        </section>

        <BillingButtons hasSubscription={hasSub} planId={plan.id} />
      </main>
    </div>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const over = used >= limit;
  return (
    <div className={styles.usage}>
      <div className={styles.usageHead}>
        <span>{label}</span>
        <span className={over ? styles.over : ''}>
          {used} / {limit}
        </span>
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%`, background: over ? '#e0533c' : undefined }} />
      </div>
    </div>
  );
}
