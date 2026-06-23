/**
 * GET  → list the user's campaigns with lead counts.
 * POST → create a campaign. Body: { name, intensity?, window_start?, window_end?,
 *        max_attempts?, max_per_day? }.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTENSITIES = ['aggressiv', 'moderat', 'konservativ'];

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const [{ data: campaigns }, { data: leads }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('call_leads').select('campaign_id, status, do_not_call').eq('user_id', user.id),
  ]);

  const counts = new Map<string, { total: number; offen: number; erledigt: number; gesperrt: number }>();
  for (const l of leads ?? []) {
    if (!l.campaign_id) continue;
    const c = counts.get(l.campaign_id) ?? { total: 0, offen: 0, erledigt: 0, gesperrt: 0 };
    c.total += 1;
    if (l.do_not_call) c.gesperrt += 1;
    else if (['erledigt', 'kein_interesse'].includes(l.status)) c.erledigt += 1;
    else c.offen += 1;
    counts.set(l.campaign_id, c);
  }

  const withCounts = (campaigns ?? []).map((c) => ({ ...c, counts: counts.get(c.id) ?? { total: 0, offen: 0, erledigt: 0, gesperrt: 0 } }));
  return NextResponse.json({ campaigns: withCounts });
}

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });

  const num = (v: unknown, def: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
  };

  const insert = {
    user_id: user.id,
    name,
    status: 'entwurf',
    intensity: INTENSITIES.includes(String(body.intensity)) ? String(body.intensity) : 'moderat',
    window_start: num(body.window_start, 9, 0, 23),
    window_end: num(body.window_end, 17, 1, 24),
    max_attempts: num(body.max_attempts, 3, 1, 10),
    max_per_day: num(body.max_per_day, 50, 1, 1000),
  };

  const { data, error } = await supabase.from('campaigns').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ campaign: data });
}
