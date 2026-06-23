/**
 * PATCH  → update a campaign (status start/pause, settings).
 * DELETE → remove a campaign (its leads are detached, not deleted).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS = ['entwurf', 'aktiv', 'pausiert', 'fertig'];
const INTENSITIES = ['aggressiv', 'moderat', 'konservativ'];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if (STATUS.includes(String(body.status))) patch.status = String(body.status);
  if (INTENSITIES.includes(String(body.intensity))) patch.intensity = String(body.intensity);
  const num = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
  };
  for (const [key, min, max] of [
    ['window_start', 0, 23],
    ['window_end', 1, 24],
    ['max_attempts', 1, 10],
    ['max_per_day', 1, 1000],
  ] as const) {
    if (key in body) {
      const v = num(body[key], min, max);
      if (v !== undefined) patch[key] = v;
    }
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  // Detach leads first so they aren't orphaned with a dangling campaign_id.
  await supabase.from('call_leads').update({ campaign_id: null }).eq('campaign_id', params.id).eq('user_id', user.id);
  const { error } = await supabase.from('campaigns').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
