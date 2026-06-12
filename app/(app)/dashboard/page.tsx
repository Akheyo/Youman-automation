import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import { planForUser, isUnlimited } from '@/lib/plans';
import Onboarding from './Onboarding';
import styles from './dashboard.module.css';

export const metadata: Metadata = { title: 'Übersicht · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, leadsRes, callLeadsRes, callsRes, meetingsRes, googleRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('call_leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('calls').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('meetings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
    supabase.from('google_tokens').select('user_id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const plan = planForUser({ plan: profile?.plan, email: user.email });
  const unlimited = isUnlimited(plan);
  const status = profile?.subscription_status as string | null;
  const meetings = meetingsRes.data ?? [];
  const meetingsBooked = meetings.filter((m) => m.status === 'gebucht').length;

  const onboardingSteps = [
    {
      id: 'search',
      title: 'Erste Firmen finden',
      desc: 'Lass Felix passende Unternehmen für dich recherchieren.',
      href: '/felix',
      cta: 'Starten',
      done: (profile?.search_count ?? 0) > 0 || (leadsRes.count ?? 0) > 0,
    },
    {
      id: 'calendar',
      title: 'Google-Kalender verbinden',
      desc: 'Damit Lina Termine direkt in deinen Kalender buchen kann.',
      href: '/einstellungen',
      cta: 'Verbinden',
      done: (googleRes.count ?? 0) > 0,
    },
    {
      id: 'call',
      title: 'Ersten KI-Anruf starten',
      desc: 'Lina ruft einen Lead an und vereinbart einen Termin.',
      href: '/sales',
      cta: 'Zu Lina',
      done: (profile?.call_count ?? 0) > 0 || (callsRes.count ?? 0) > 0,
    },
  ];

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Übersicht</h1>
            <p className={styles.hello}>Willkommen zurück — {user.email}</p>
          </div>
          <Link href="/felix" className={styles.primaryAction}>
            + Neue Suche
          </Link>
        </div>

        <Onboarding steps={onboardingSteps} />

        <div className={styles.statRow}>
          <Stat value={leadsRes.count ?? 0} label="Felix-Leads" />
          <Stat value={callLeadsRes.count ?? 0} label="Telefon-Leads" />
          <Stat value={callsRes.count ?? 0} label="Anrufe" />
          <Stat value={meetingsBooked} label="Termine gebucht" accent />
        </div>

        <div className={styles.shortcuts}>
          <Link href="/felix" className={styles.shortcut}>
            <span className={styles.scEmoji}>🕵️</span>
            <span className={styles.scTitle}>Felix &amp; Team</span>
            <span className={styles.scDesc}>Firmen finden, analysieren, anschreiben</span>
          </Link>
          <Link href="/sales" className={styles.shortcut}>
            <span className={styles.scEmoji}>📞</span>
            <span className={styles.scTitle}>Lina · Telefon</span>
            <span className={styles.scDesc}>Leads anrufen &amp; Termine buchen</span>
          </Link>
          <Link href="/leads" className={styles.shortcut}>
            <span className={styles.scEmoji}>📋</span>
            <span className={styles.scTitle}>Alle Leads</span>
            <span className={styles.scDesc}>Firmen &amp; Telefon-Leads im Überblick</span>
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <div className={styles.label}>Dein Tarif</div>
              <div className={styles.planName}>
                {plan.name} {status && status !== 'active' && <span className={styles.status}>({status})</span>}
              </div>
            </div>
            <Link href="/einstellungen" className={styles.sectionLink}>
              Verwalten →
            </Link>
          </div>
          <Usage label="Firmensuchen" used={profile?.search_count ?? 0} limit={plan.searches} unlimited={unlimited} />
          <Usage label="Pitch-Mails" used={profile?.email_count ?? 0} limit={plan.emails} unlimited={unlimited} />
          <Usage label="KI-Anrufe" used={profile?.call_count ?? 0} limit={plan.calls} unlimited={unlimited} />
          <div className={styles.reset}>
            {unlimited ? 'Unbegrenzte Nutzung für diesen Account aktiv.' : 'Zähler werden zu Monatsbeginn zurückgesetzt.'}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}>
            Nächste Termine
            <Link href="/verlaeufe" className={styles.sectionLink}>
              Alle Verläufe →
            </Link>
          </div>
          {meetings.length === 0 ? (
            <p className={styles.empty}>Noch keine Termine. Sobald Lina einen Termin bucht, erscheint er hier.</p>
          ) : (
            <div className={styles.leadTable}>
              {meetings.map((m) => (
                <div key={m.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{m.contact_name || m.company || 'Kontakt'}</span>
                  <span className={styles.leadSub}>{m.requested_time ? new Date(m.requested_time).toLocaleString('de-DE') : ''}</span>
                  <span className={styles.tag}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className={accent ? styles.statAccent : styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function Usage({ label, used, limit, unlimited }: { label: string; used: number; limit: number; unlimited?: boolean }) {
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const over = !unlimited && used >= limit;
  return (
    <div className={styles.usage}>
      <div className={styles.usageHead}>
        <span>{label}</span>
        <span className={over ? styles.over : ''}>{unlimited ? `${used} / ∞` : `${used} / ${limit}`}</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%`, background: over ? '#e0533c' : undefined }} />
      </div>
    </div>
  );
}
