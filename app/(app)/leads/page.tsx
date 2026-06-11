import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import styles from '../dashboard/dashboard.module.css';

export const metadata: Metadata = { title: 'Leads · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const { supabase, user } = await requireUser();

  const [callLeadsRes, leadsRes] = await Promise.all([
    supabase.from('call_leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
  ]);
  const callLeads = callLeadsRes.data ?? [];
  const leads = leadsRes.data ?? [];

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Leads</h1>
            <p className={styles.hello}>Alle Firmen &amp; Telefon-Leads an einem Ort</p>
          </div>
          <Link href="/sales" className={styles.primaryAction}>
            Telefon-Leads verwalten
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>
            📞 Telefon-Leads ({callLeads.length})
            <Link href="/sales" className={styles.sectionLink}>
              Hinzufügen / Anrufen →
            </Link>
          </div>
          {callLeads.length === 0 ? (
            <p className={styles.empty}>Noch keine Telefon-Leads. Füge sie bei Lina hinzu oder übergib sie aus Felix.</p>
          ) : (
            <div className={styles.leadTable}>
              {callLeads.map((l) => (
                <div key={l.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{l.name || l.company || l.phone}</span>
                  <span className={styles.leadSub}>
                    {l.phone}
                    {l.notes ? ` · ${l.notes}` : ''}
                  </span>
                  <span className={styles.tag} data-s={l.status}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>
            🕵️ Felix-Leads ({leads.length})
            <Link href="/felix" className={styles.sectionLink}>
              Neue Suche →
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className={styles.empty}>Noch keine gespeicherten Firmen. Such mit Felix nach Unternehmen.</p>
          ) : (
            <div className={styles.leadTable}>
              {leads.map((l) => (
                <div key={l.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{l.name}</span>
                  <span className={styles.leadSub}>{l.email || l.phone || l.website || l.address || '—'}</span>
                  <span className={styles.tag}>{l.status ?? 'neu'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
