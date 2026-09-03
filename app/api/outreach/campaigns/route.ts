/**
 * GET  → Kampagnen des Nutzers samt Kontakt- und Versandzahlen.
 * POST → neue Kampagne. Body: { name, from_name?, from_email?, reply_to?,
 *        signature?, window_start?, window_end?, send_on_weekend?, max_per_day?,
 *        stop_on_reply? }. Eine Startsequenz (Erstmail + zwei Follow-ups) wird
 *        gleich mit angelegt, damit niemand vor einem leeren Editor sitzt.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STARTER_SEQUENCE } from '@/lib/outreach/presets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const [{ data: campaigns }, { data: contacts }, { data: events }] = await Promise.all([
    supabase.from('outreach_campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('outreach_contacts').select('campaign_id, status').eq('user_id', user.id),
    supabase.from('outreach_events').select('campaign_id, kind').eq('user_id', user.id).in('kind', ['gesendet', 'geoeffnet']),
  ]);

  const counts = new Map<string, Record<string, number>>();
  const bump = (id: string | null, key: string) => {
    if (!id) return;
    const c = counts.get(id) ?? { total: 0, offen: 0, geantwortet: 0, abgemeldet: 0, fertig: 0, gesendet: 0, geoeffnet: 0 };
    c[key] = (c[key] ?? 0) + 1;
    counts.set(id, c);
  };
  for (const c of contacts ?? []) {
    bump(c.campaign_id, 'total');
    if (c.status === 'neu' || c.status === 'aktiv') bump(c.campaign_id, 'offen');
    else if (c.status === 'geantwortet') bump(c.campaign_id, 'geantwortet');
    else if (c.status === 'abgemeldet') bump(c.campaign_id, 'abgemeldet');
    else if (c.status === 'fertig') bump(c.campaign_id, 'fertig');
  }
  for (const e of events ?? []) bump(e.campaign_id, e.kind === 'geoeffnet' ? 'geoeffnet' : 'gesendet');

  const withCounts = (campaigns ?? []).map((c) => ({
    ...c,
    counts: counts.get(c.id) ?? { total: 0, offen: 0, geantwortet: 0, abgemeldet: 0, fertig: 0, gesendet: 0, geoeffnet: 0 },
  }));
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
  const str = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s ? s : null;
  };

  const { data: campaign, error } = await supabase
    .from('outreach_campaigns')
    .insert({
      user_id: user.id,
      name,
      status: 'entwurf',
      from_name: str(body.from_name),
      from_email: str(body.from_email),
      reply_to: str(body.reply_to),
      signature: str(body.signature),
      window_start: num(body.window_start, 8, 0, 23),
      window_end: num(body.window_end, 18, 1, 24),
      send_on_weekend: body.send_on_weekend === true,
      max_per_day: num(body.max_per_day, 40, 1, 1000),
      stop_on_reply: body.stop_on_reply !== false,
    })
    .select()
    .single();
  if (error || !campaign) return NextResponse.json({ error: error?.message ?? 'Kampagne konnte nicht angelegt werden.' }, { status: 400 });

  const steps = STARTER_SEQUENCE.map((s) => ({ ...s, campaign_id: campaign.id, user_id: user.id }));
  await supabase.from('outreach_steps').insert(steps);

  return NextResponse.json({ campaign: { ...campaign, counts: { total: 0, offen: 0, geantwortet: 0, abgemeldet: 0, fertig: 0, gesendet: 0, geoeffnet: 0 } } });
}
