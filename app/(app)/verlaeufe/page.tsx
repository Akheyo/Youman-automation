import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import styles from '../dashboard/dashboard.module.css';

export const metadata: Metadata = { title: 'Verläufe · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function VerlaeufePage() {
  const { supabase, user } = await requireUser();

  const [callsRes, emailsRes] = await Promise.all([
    supabase.from('calls').select('*, call_leads(name, company, phone)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('sent_emails').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
  ]);
  const calls = callsRes.data ?? [];
  const emails = emailsRes.data ?? [];

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Verläufe</h1>
            <p className={styles.hello}>Anrufe, Transkripte &amp; gesendete Mails</p>
          </div>
          <Link href="/sales" className={styles.primaryAction}>
            Transkripte ansehen
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>
            Anrufe ({calls.length})
            <Link href="/sales" className={styles.sectionLink}>
              Mit Transkript →
            </Link>
          </div>
          {calls.length === 0 ? (
            <p className={styles.empty}>Noch keine Anrufe geführt.</p>
          ) : (
            <div className={styles.leadTable}>
              {calls.map((c) => (
                <div key={c.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{c.call_leads?.name || c.call_leads?.company || c.call_leads?.phone || 'Unbekannt'}</span>
                  <span className={styles.leadSub}>
                    {c.outcome ? c.outcome : c.status}
                    {c.duration_sec != null && ` · ${Math.floor(c.duration_sec / 60)}:${String(c.duration_sec % 60).padStart(2, '0')} min`}
                  </span>
                  <span className={styles.leadDate}>{new Date(c.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>Gesendete Pitch-Mails ({emails.length})</div>
          {emails.length === 0 ? (
            <p className={styles.empty}>Noch keine Mails versendet.</p>
          ) : (
            <div className={styles.leadTable}>
              {emails.map((e) => (
                <div key={e.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{e.company || e.to_email}</span>
                  <span className={styles.leadSub}>{e.subject || e.to_email}</span>
                  <span className={styles.leadDate}>{new Date(e.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
