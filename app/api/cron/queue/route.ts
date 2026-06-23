/**
 * Campaign scheduler — runs the outbound call queue.
 *
 * Designed to be called on a schedule (Vercel Cron or any external scheduler,
 * e.g. every 10 minutes). For each ACTIVE campaign it:
 *   - respects the call window (business hours, Mon–Fri, in the campaign tz),
 *   - respects the per-campaign daily cap and per-lead max attempts,
 *   - respects the user's monthly call quota (owners unlimited),
 *   - places due calls via the shared dialer.
 *
 * Auth: when CRON_SECRET is set, requests must send `Authorization: Bearer <secret>`.
 * Vercel Cron adds this header automatically when the CRON_SECRET env var exists.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { vapiConfigured } from '@/lib/vapi';
import { placeCall } from '@/lib/sales/dialer';
import { planForUser, isOwnerEmail } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Safety cap: never place more than this many calls in a single invocation.
const GLOBAL_CAP = 25;
// Per-campaign batch per invocation (keeps calls paced, not bursty).
const PER_CAMPAIGN_BATCH = 8;

function localHourWeekday(tz: string, now: Date): { hour: number; weekday: string } {
  const zone = tz || 'Europe/Berlin';
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now);
  }
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { hour: parseInt(map.hour ?? '0', 10), weekday: map.weekday ?? 'Mon' };
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase Service-Role nicht konfiguriert.' }, { status: 503 });
  if (!vapiConfigured()) return NextResponse.json({ ok: true, placed: 0, skipped: 'vapi-not-configured' });

  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: campaigns } = await admin.from('campaigns').select('*').eq('status', 'aktiv');

  let placed = 0;
  const report: Record<string, unknown>[] = [];

  for (const c of campaigns ?? []) {
    if (placed >= GLOBAL_CAP) break;

    const { hour, weekday } = localHourWeekday(c.timezone, now);
    if (weekday === 'Sat' || weekday === 'Sun') {
      report.push({ campaign: c.id, skip: 'weekend' });
      continue;
    }
    if (!(hour >= c.window_start && hour < c.window_end)) {
      report.push({ campaign: c.id, skip: 'outside-window', hour });
      continue;
    }

    // Leads of this campaign + how many calls already went out today.
    const { data: campLeads } = await admin.from('call_leads').select('id').eq('campaign_id', c.id);
    const ids = (campLeads ?? []).map((x) => x.id);
    let placedToday = 0;
    if (ids.length) {
      const { count } = await admin
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .in('lead_id', ids)
        .gte('created_at', startOfDay.toISOString());
      placedToday = count ?? 0;
    }
    const remainingToday = Math.max(0, c.max_per_day - placedToday);
    if (remainingToday === 0) {
      report.push({ campaign: c.id, skip: 'daily-cap' });
      continue;
    }

    const batch = Math.min(remainingToday, GLOBAL_CAP - placed, PER_CAMPAIGN_BATCH);
    const { data: due } = await admin
      .from('call_leads')
      .select('*')
      .eq('campaign_id', c.id)
      .eq('do_not_call', false)
      .in('status', ['bereit', 'nicht_erreicht'])
      .lte('next_attempt_at', now.toISOString())
      .lt('attempts', c.max_attempts)
      .order('next_attempt_at', { ascending: true })
      .limit(batch);

    if (!due || due.length === 0) {
      // Nothing due. If nothing is open at all, mark the campaign finished.
      const { count: openCount } = await admin
        .from('call_leads')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('do_not_call', false)
        .in('status', ['bereit', 'nicht_erreicht'])
        .lt('attempts', c.max_attempts);
      if (ids.length && (openCount ?? 0) === 0) await admin.from('campaigns').update({ status: 'fertig' }).eq('id', c.id);
      report.push({ campaign: c.id, due: 0 });
      continue;
    }

    // Plan / quota for this campaign's owner.
    const { data: profile } = await admin.from('profiles').select('plan, full_name, email').eq('id', c.user_id).single();
    const owner = isOwnerEmail(profile?.email);
    const plan = planForUser({ plan: profile?.plan, email: profile?.email });

    for (const lead of due) {
      if (placed >= GLOBAL_CAP) break;
      if (!owner) {
        const { data: allowed, error } = await admin.rpc('consume_call_quota_for', { p_user: c.user_id, p_limit: plan.calls });
        if (!error && allowed === false) {
          report.push({ campaign: c.id, skip: 'quota' });
          break;
        }
      }
      const res = await placeCall(admin, { userId: c.user_id, lead, ownerName: profile?.full_name || 'Youman Automation' });
      if (res.ok) placed += 1;
      report.push({ campaign: c.id, lead: lead.id, ok: res.ok });
    }
  }

  return NextResponse.json({ ok: true, placed, report });
}
