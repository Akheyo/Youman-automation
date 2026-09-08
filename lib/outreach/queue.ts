/**
 * Die Versand-Queue: arbeitet aktive Outreach-Kampagnen Schritt für Schritt ab.
 *
 * Aufgeteilt wie beim Telefon-Agenten: `sendNextStep` schickt genau eine Mail
 * für genau einen Kontakt (und wird auch vom "Jetzt senden"-Knopf benutzt),
 * `runOutreachQueue` ist die Runde, die der Cron alle paar Minuten aufruft.
 *
 * Kontingent- und Fensterprüfungen macht der Aufrufer bzw. `runOutreachQueue`;
 * `sendNextStep` prüft nur, was pro Kontakt gilt: Sperrliste, Abmeldung,
 * vollständige Platzhalter.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { renderStep, type ContactVars } from './template';
import { sendOutreachMail, unsubscribeUrlFor, oneClickUrlFor } from './sender';
import { newTrackToken, pixelUrlFor } from './tracking';
import { mailboxes, warmupConfig, waehleMailbox, type MailboxAuslastung } from './mailboxes';
import { bewerte } from './health';
import { nextSendAt, isWithinWindow, batchSize, type SendWindow } from './schedule';

export interface OutreachCampaign extends SendWindow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  from_name?: string | null;
  from_email?: string | null;
  reply_to?: string | null;
  signature?: string | null;
  max_per_day: number;
  stop_on_reply?: boolean | null;
  /** Öffnungsmessung — bewusst je Kampagne und standardmäßig aus. */
  track_opens?: boolean | null;
}

export interface OutreachStep {
  step_no: number;
  delay_days: number;
  subject: string;
  body: string;
}

export interface OutreachContact extends ContactVars {
  id: string;
  campaign_id: string;
  status: string;
  current_step: number;
  unsubscribe_token: string;
  thread_subject?: string | null;
  message_id?: string | null;
  fails?: number | null;
}

export type StepResult =
  | { ok: true; step_no: number; subject: string; done: boolean }
  | { ok: false; error: string; fatal?: boolean };

/** Nach so vielen Zustellfehlern in Folge wird der Kontakt angehalten. */
const MAX_FAILS = 3;

async function logEvent(
  sb: SupabaseClient,
  row: {
    user_id: string;
    campaign_id: string;
    contact_id: string;
    step_no?: number | null;
    kind: string;
    subject?: string | null;
    detail?: string | null;
    track_token?: string | null;
    mailbox?: string | null;
  },
) {
  await sb.from('outreach_events').insert(row);
}

/**
 * Schickt den nächsten fälligen Schritt der Sequenz an einen Kontakt und
 * plant den Schritt danach ein.
 */
export async function sendNextStep(
  sb: SupabaseClient,
  opts: {
    campaign: OutreachCampaign;
    steps: OutreachStep[];
    contact: OutreachContact;
    now?: Date;
    /** Von der Queue gewaehltes Postfach. Ohne Angabe: das erste eingerichtete. */
    postfach?: { settings: import('./smtp').SmtpSettings; from: string; id: string };
  },
): Promise<StepResult> {
  const { campaign, contact } = opts;
  const now = opts.now ?? new Date();
  const steps = [...opts.steps].sort((a, b) => a.step_no - b.step_no);

  const step = steps.find((s) => s.step_no === contact.current_step + 1);
  if (!step) {
    await sb.from('outreach_contacts').update({ status: 'fertig', next_send_at: null }).eq('id', contact.id);
    return { ok: false, error: 'Kein weiterer Schritt in der Sequenz.', fatal: true };
  }

  // Kontoweite Sperrliste hat immer Vorrang — auch bei frischem Import.
  const { data: blocked } = await sb
    .from('outreach_suppression')
    .select('email')
    .eq('user_id', campaign.user_id)
    .eq('email', (contact.email ?? '').toLowerCase())
    .maybeSingle();
  if (blocked) {
    await sb.from('outreach_contacts').update({ status: 'abgemeldet', next_send_at: null }).eq('id', contact.id);
    await logEvent(sb, {
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      contact_id: contact.id,
      kind: 'abgemeldet',
      detail: 'Adresse steht auf der Sperrliste.',
    });
    return { ok: false, error: 'Adresse steht auf der Sperrliste.', fatal: true };
  }

  const sender = { from_name: campaign.from_name, signature: campaign.signature };

  // Folgeschritte ohne eigenen Betreff haengen sich an den Betreff der Erstmail.
  // Der steht normalerweise am Kontakt; fehlt er (Alt-Datensatz, Import), wird
  // er aus Schritt 1 abgeleitet, statt das Follow-up haengen zu lassen.
  const threadSubject =
    contact.thread_subject ?? (steps[0] ? renderStep(steps[0], contact, sender).subject || undefined : undefined);

  const rendered = renderStep(step, contact, sender, threadSubject);

  // Lücken in der Personalisierung ("Hallo ,") würden die Mail verbrennen —
  // lieber anhalten und den Kontakt melden, als sie so zu verschicken.
  if (rendered.missing.length > 0) {
    const detail = `Platzhalter ohne Wert: ${rendered.missing.join(', ')}`;
    await sb.from('outreach_contacts').update({ status: 'gestoppt', next_send_at: null, last_error: detail }).eq('id', contact.id);
    await logEvent(sb, { user_id: campaign.user_id, campaign_id: campaign.id, contact_id: contact.id, step_no: step.step_no, kind: 'fehler', detail });
    return { ok: false, error: detail, fatal: true };
  }
  if (!rendered.subject) {
    const detail = 'Betreff fehlt (Schritt 1 braucht immer einen Betreff).';
    await sb.from('outreach_contacts').update({ status: 'gestoppt', next_send_at: null, last_error: detail }).eq('id', contact.id);
    await logEvent(sb, { user_id: campaign.user_id, campaign_id: campaign.id, contact_id: contact.id, step_no: step.step_no, kind: 'fehler', detail });
    return { ok: false, error: detail, fatal: true };
  }

  // Ein Token je versendeter Mail. Es wird nur eingebettet, wenn die Kampagne
  // wirklich misst — sonst gibt es kein Pixel und nichts zu speichern.
  const trackToken = campaign.track_opens ? newTrackToken() : null;

  const res = await sendOutreachMail({
    to: contact.email,
    subject: rendered.subject,
    body: rendered.body,
    fromName: campaign.from_name,
    fromEmail: campaign.from_email,
    replyTo: campaign.reply_to,
    company: contact.company,
    unsubscribeUrl: unsubscribeUrlFor(contact.unsubscribe_token),
    oneClickUrl: oneClickUrlFor(contact.unsubscribe_token),
    inReplyTo: step.step_no > 1 ? contact.message_id : null,
    trackingPixelUrl: trackToken ? pixelUrlFor(trackToken) : null,
  }, 20_000, opts.postfach ? { settings: opts.postfach.settings, from: opts.postfach.from } : undefined);

  if (!res.ok) {
    const fails = (contact.fails ?? 0) + 1;
    const giveUp = fails >= MAX_FAILS;
    await sb
      .from('outreach_contacts')
      .update({
        fails,
        last_error: res.error,
        status: giveUp ? 'gestoppt' : contact.status,
        next_send_at: giveUp ? null : new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .eq('id', contact.id);
    await logEvent(sb, {
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      contact_id: contact.id,
      step_no: step.step_no,
      kind: 'fehler',
      subject: rendered.subject,
      detail: giveUp ? `${res.error} — nach ${fails} Versuchen angehalten.` : res.error,
    });
    return { ok: false, error: res.error, fatal: giveUp };
  }

  const following = steps.find((s) => s.step_no === step.step_no + 1);
  const done = !following;

  await sb
    .from('outreach_contacts')
    .update({
      current_step: step.step_no,
      status: done ? 'fertig' : 'aktiv',
      last_sent_at: now.toISOString(),
      last_error: null,
      fails: 0,
      next_send_at: done ? null : nextSendAt(campaign, following!.delay_days, now).toISOString(),
      thread_subject: contact.thread_subject ?? threadSubject ?? rendered.subject,
      message_id: contact.message_id ?? res.messageId ?? null,
    })
    .eq('id', contact.id);

  await logEvent(sb, {
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    contact_id: contact.id,
    step_no: step.step_no,
    kind: 'gesendet',
    subject: rendered.subject,
    track_token: trackToken,
    mailbox: opts.postfach?.id ?? null,
  });

  return { ok: true, step_no: step.step_no, subject: rendered.subject, done };
}

export interface QueueOptions {
  /** Obergrenze für den gesamten Lauf (schützt die Cron-Laufzeit). */
  globalCap?: number;
  now?: Date;
  /** Kontingentprüfung je Mail. `false` bricht die Kampagne für diesen Lauf ab. */
  consumeQuota?: (userId: string) => Promise<boolean>;
}

export interface QueueReport {
  sent: number;
  report: Record<string, unknown>[];
}

/** Eine Runde über alle aktiven Kampagnen. */
export async function runOutreachQueue(sb: SupabaseClient, opts: QueueOptions = {}): Promise<QueueReport> {
  const now = opts.now ?? new Date();
  const globalCap = opts.globalCap ?? 40;
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: campaigns } = await sb.from('outreach_campaigns').select('*').eq('status', 'aktiv');

  let sent = 0;
  const report: Record<string, unknown>[] = [];

  // Postfach-Pool und Tagesstand einmal je Lauf ermitteln.
  const pool = mailboxes();
  const warmup = warmupConfig();
  const auslastung: Record<string, MailboxAuslastung> = {};
  if (pool.length > 0) {
    for (const mb of pool) {
      const { count } = await sb
        .from('outreach_events')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'gesendet')
        .eq('mailbox', mb.id)
        .gte('created_at', startOfDay.toISOString());
      const { data: erste } = await sb
        .from('outreach_events')
        .select('created_at')
        .eq('kind', 'gesendet')
        .eq('mailbox', mb.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      auslastung[mb.id] = { heute: count ?? 0, ersterVersand: erste?.created_at ?? null };
    }
  }

  for (const campaign of (campaigns ?? []) as OutreachCampaign[]) {
    if (sent >= globalCap) break;

    if (!isWithinWindow(campaign, now)) {
      report.push({ campaign: campaign.id, skip: 'ausserhalb-versandfenster' });
      continue;
    }

    // Schutzschalter: kippen Bounce- oder Abmeldequote, wird die Kampagne
    // angehalten, statt weiter am Ruf der Absenderdomain zu kratzen.
    const { data: bilanz } = await sb.from('outreach_events').select('kind').eq('campaign_id', campaign.id);
    const zaehlwerk = { gesendet: 0, bounces: 0, abmeldungen: 0 };
    for (const e of bilanz ?? []) {
      if (e.kind === 'gesendet') zaehlwerk.gesendet += 1;
      else if (e.kind === 'bounce') zaehlwerk.bounces += 1;
      else if (e.kind === 'abgemeldet') zaehlwerk.abmeldungen += 1;
    }
    const befund = bewerte(zaehlwerk);
    if (befund.stoppen) {
      await sb.from('outreach_campaigns').update({ status: 'pausiert', paused_reason: befund.grund }).eq('id', campaign.id);
      report.push({ campaign: campaign.id, skip: 'schutzschalter', grund: befund.grund });
      continue;
    }

    const { data: stepRows } = await sb
      .from('outreach_steps')
      .select('step_no, delay_days, subject, body')
      .eq('campaign_id', campaign.id)
      .order('step_no', { ascending: true });
    const steps = (stepRows ?? []) as OutreachStep[];
    if (steps.length === 0) {
      report.push({ campaign: campaign.id, skip: 'keine-schritte' });
      continue;
    }

    // Tageslimit: heute bereits versendete Mails dieser Kampagne.
    const { count: sentToday } = await sb
      .from('outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('kind', 'gesendet')
      .gte('created_at', startOfDay.toISOString());
    const remainingToday = Math.max(0, campaign.max_per_day - (sentToday ?? 0));
    if (remainingToday === 0) {
      report.push({ campaign: campaign.id, skip: 'tageslimit' });
      continue;
    }

    // Selbstheilung: Kontakte ohne Termin (Import kurz vor dem Start, Abbruch
    // mitten im Einplanen) bekommen einen, statt still liegen zu bleiben.
    const { data: unscheduled } = await sb
      .from('outreach_contacts')
      .select('id')
      .eq('campaign_id', campaign.id)
      .in('status', ['neu', 'aktiv'])
      .is('next_send_at', null)
      .limit(200);
    for (const c of unscheduled ?? []) {
      await sb.from('outreach_contacts').update({ next_send_at: nextSendAt(campaign, 0, now).toISOString() }).eq('id', c.id);
    }

    const batch = Math.min(batchSize(campaign, remainingToday, now), globalCap - sent);
    const { data: due } = await sb
      .from('outreach_contacts')
      .select('*')
      .eq('campaign_id', campaign.id)
      .in('status', ['neu', 'aktiv'])
      .lte('next_send_at', now.toISOString())
      .order('next_send_at', { ascending: true })
      .limit(batch);

    if (!due || due.length === 0) {
      // Nichts fällig. Wenn gar nichts mehr offen ist, ist die Kampagne durch.
      const { count: open } = await sb
        .from('outreach_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', ['neu', 'aktiv']);
      const { count: total } = await sb
        .from('outreach_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);
      if ((total ?? 0) > 0 && (open ?? 0) === 0) await sb.from('outreach_campaigns').update({ status: 'fertig' }).eq('id', campaign.id);
      report.push({ campaign: campaign.id, due: 0 });
      continue;
    }

    for (const contact of due as OutreachContact[]) {
      if (sent >= globalCap) break;
      if (opts.consumeQuota) {
        const allowed = await opts.consumeQuota(campaign.user_id);
        if (!allowed) {
          report.push({ campaign: campaign.id, skip: 'kontingent' });
          break;
        }
      }
      // Postfach mit der geringsten Tageslast waehlen. Ist der Pool leer, greift
      // der Einzel-Versandweg aus der Umgebung wie bisher.
      let postfach: { settings: import('./smtp').SmtpSettings; from: string; id: string } | undefined;
      if (pool.length > 0) {
        const wahl = waehleMailbox(pool, auslastung, warmup, now);
        if (!wahl) {
          report.push({ campaign: campaign.id, skip: 'tageskapazitaet-postfaecher' });
          break;
        }
        postfach = { settings: wahl.mailbox.settings, from: wahl.mailbox.from, id: wahl.mailbox.id };
      }

      const res = await sendNextStep(sb, { campaign, steps, contact, now, postfach });
      if (res.ok) {
        sent += 1;
        if (postfach) {
          const stand = auslastung[postfach.id] ?? { heute: 0, ersterVersand: null };
          auslastung[postfach.id] = {
            heute: stand.heute + 1,
            ersterVersand: stand.ersterVersand ?? now.toISOString(),
          };
        }
      }
      report.push({
        campaign: campaign.id,
        contact: contact.id,
        ok: res.ok,
        mailbox: postfach?.id,
        ...(res.ok ? { step: res.step_no } : { error: res.error }),
      });
    }
  }

  return { sent, report };
}
