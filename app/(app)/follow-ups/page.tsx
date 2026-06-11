import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import styles from '../dashboard/dashboard.module.css';

export const metadata: Metadata = { title: 'Follow-ups · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function FollowUpsPage() {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from('call_leads')
    .select('*')
    .eq('user_id', user.id)
    .not('follow_up_at', 'is', null)
    .order('follow_up_at', { ascending: true })
    .limit(200);
  const items = data ?? [];
  const now = Date.now();
  const due = items.filter((l) => new Date(l.follow_up_at).getTime() <= now);
  const upcoming = items.filter((l) => new Date(l.follow_up_at).getTime() > now);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Follow-ups</h1>
            <p className={styles.hello}>Geplante Rückrufe — fällige zuerst</p>
          </div>
          <Link href="/sales" className={styles.primaryAction}>
            In Lina planen
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>Fällig ({due.length})</div>
          {due.length === 0 ? (
            <p className={styles.empty}>Aktuell nichts fällig. 🎉</p>
          ) : (
            <div className={styles.leadTable}>
              {due.map((l) => (
                <FollowRow key={l.id} l={l} due />
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>Demnächst ({upcoming.length})</div>
          {upcoming.length === 0 ? (
            <p className={styles.empty}>
              Keine geplanten Follow-ups. Lina legt bei nicht erreichten Leads automatisch einen Rückruf (+2 Tage) an.
            </p>
          ) : (
            <div className={styles.leadTable}>
              {upcoming.map((l) => (
                <FollowRow key={l.id} l={l} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FollowRow({ l, due }: { l: { id: string; name: string | null; company: string | null; phone: string; follow_up_at: string; follow_up_note: string | null }; due?: boolean }) {
  return (
    <div className={styles.leadRow}>
      <span className={styles.leadName}>{l.name || l.company || l.phone}</span>
      <span className={styles.leadSub}>{l.follow_up_note || l.phone}</span>
      <span className={styles.tag} data-s={due ? 'anruf' : 'bereit'}>
        {new Date(l.follow_up_at).toLocaleDateString('de-DE')}
        {due ? ' · fällig' : ''}
      </span>
    </div>
  );
}
