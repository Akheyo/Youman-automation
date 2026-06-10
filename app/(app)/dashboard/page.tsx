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

  // Load everything for the central hub in parallel.
  const [{ data: profile }, leadsRes, callLeadsRes, callsRes, meetingsRes, emailsRes, googleRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('call_leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('calls').select('*, call_leads(name, company, phone)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
    supabase.from('meetings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
    supabase.from('sent_emails').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
    supabase.from('google_tokens').select('email').eq('user_id', user.id).single(),
  ]);

  const plan = planFor(profile?.plan);
  const searchUsed = profile?.search_count ?? 0;
  const emailUsed = profile?.email_count ?? 0;
  const callUsed = profile?.call_count ?? 0;
  const hasSub = Boolean(profile?.stripe_subscription_id);
  const status = profile?.subscription_status as string | null;

  const leads = leadsRes.data ?? [];
  const callLeads = callLeadsRes.data ?? [];
  const calls = callsRes.data ?? [];
  const meetings = meetingsRes.data ?? [];
  const emails = emailsRes.data ?? [];
  const googleEmail = googleRes.data?.email ?? null;

  const meetingsBooked = meetings.filter((m) => m.status === 'gebucht').length;
  const followUps = callLeads
    .filter((l) => l.follow_up_at)
    .sort((a, b) => String(a.follow_up_at).localeCompare(String(b.follow_up_at)));

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

        {/* Stat row */}
        <div className={styles.statRow}>
          <Stat value={leads.length} label="Felix-Leads" />
          <Stat value={callLeads.length} label="Telefon-Leads" />
          <Stat value={calls.length} label="Anrufe" />
          <Stat value={meetingsBooked} label="Termine gebucht" accent />
        </div>

        {/* Jump-in shortcuts */}
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
          <Link href="/pricing" className={styles.shortcut}>
            <span className={styles.scEmoji}>⭐</span>
            <span className={styles.scTitle}>Tarif &amp; Limits</span>
            <span className={styles.scDesc}>Mehr Suchen, Mails &amp; Anrufe</span>
          </Link>
        </div>

        {/* Plan & usage */}
        <section className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <div className={styles.label}>Dein Tarif</div>
              <div className={styles.planName}>
                {plan.name} {status && status !== 'active' && <span className={styles.status}>({status})</span>}
              </div>
            </div>
          </div>
          <Usage label="Firmensuchen" used={searchUsed} limit={plan.searches} />
          <Usage label="Pitch-Mails" used={emailUsed} limit={plan.emails} />
          <Usage label="KI-Anrufe" used={callUsed} limit={plan.calls} />
          <div className={styles.reset}>Zähler werden zu Monatsbeginn zurückgesetzt.</div>
        </section>

        {/* All leads */}
        <section id="leads" className={styles.card}>
          <div className={styles.sectionTitle}>
            Alle Leads
            <Link href="/sales" className={styles.sectionLink}>
              Telefon-Leads verwalten →
            </Link>
          </div>

          <h3 className={styles.subhead}>📞 Telefon-Leads ({callLeads.length})</h3>
          {callLeads.length === 0 ? (
            <p className={styles.empty}>Noch keine Telefon-Leads. Füge sie bei Lina hinzu oder übergib sie aus Felix.</p>
          ) : (
            <div className={styles.leadTable}>
              {callLeads.slice(0, 10).map((l) => (
                <div key={l.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{l.name || l.company || l.phone}</span>
                  <span className={styles.leadSub}>{l.phone}</span>
                  <span className={styles.tag} data-s={l.status}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <h3 className={styles.subhead}>🕵️ Felix-Leads ({leads.length})</h3>
          {leads.length === 0 ? (
            <p className={styles.empty}>Noch keine gespeicherten Firmen. Such mit Felix nach Unternehmen.</p>
          ) : (
            <div className={styles.leadTable}>
              {leads.slice(0, 10).map((l) => (
                <div key={l.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{l.name}</span>
                  <span className={styles.leadSub}>{l.email || l.phone || l.website || l.address || '—'}</span>
                  <span className={styles.tag}>{l.status ?? 'neu'}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Follow-ups */}
        <section id="followups" className={styles.card}>
          <div className={styles.sectionTitle}>
            Anstehende Follow-ups
            <Link href="/sales" className={styles.sectionLink}>
              In Lina planen →
            </Link>
          </div>
          {followUps.length === 0 ? (
            <p className={styles.empty}>Keine Follow-ups geplant. Lina legt bei nicht erreichten Leads automatisch einen Rückruf an.</p>
          ) : (
            <div className={styles.leadTable}>
              {followUps.slice(0, 10).map((l) => (
                <div key={l.id} className={styles.leadRow}>
                  <span className={styles.leadName}>{l.name || l.company || l.phone}</span>
                  <span className={styles.leadSub}>{l.follow_up_note || l.phone}</span>
                  <span className={styles.leadDate}>{l.follow_up_at ? new Date(l.follow_up_at).toLocaleDateString('de-DE') : ''}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Verläufe */}
        <section id="verlaeufe" className={styles.card}>
          <div className={styles.sectionTitle}>
            Verläufe
            <Link href="/sales" className={styles.sectionLink}>
              Anrufe &amp; Transkripte →
            </Link>
          </div>

          <h3 className={styles.subhead}>Letzte Anrufe</h3>
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

          <h3 className={styles.subhead}>Gesendete Pitch-Mails</h3>
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

        {/* Einstellungen */}
        <section id="einstellungen" className={styles.card}>
          <div className={styles.sectionTitle}>Einstellungen</div>

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
              <div className={styles.settingName}>Lina-Charakter</div>
              <div className={styles.settingDesc}>Tonfall, Ziel &amp; Gesprächsleitfaden des Telefon-Agenten anpassen.</div>
            </div>
            <Link href="/sales" className={styles.settingBtn}>
              Bearbeiten
            </Link>
          </div>

          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingName}>Abrechnung</div>
              <div className={styles.settingDesc}>Tarif wechseln, Zahlungsdaten &amp; Rechnungen verwalten.</div>
            </div>
            <BillingButtons hasSubscription={hasSub} planId={plan.id} />
          </div>
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
