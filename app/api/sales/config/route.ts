/**
 * GET  → the user's Lina "Soul" config (creates defaults on first read).
 * PUT  → update the config. Body: partial AgentConfig fields.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AGENT } from '@/lib/sales/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDITABLE = ['agent_name', 'language', 'voice', 'goal', 'opening_line', 'persona', 'guidelines', 'dos', 'donts', 'booking_link', 'max_duration'] as const;

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data } = await supabase.from('agent_config').select('*').eq('user_id', user.id).single();
  return NextResponse.json({ config: data ?? { user_id: user.id, ...DEFAULT_AGENT } });
}

export async function PUT(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  for (const key of EDITABLE) {
    if (key in body) patch[key] = body[key];
  }
  if (typeof patch.max_duration === 'string') patch.max_duration = Number(patch.max_duration) || DEFAULT_AGENT.max_duration;

  const { data, error } = await supabase.from('agent_config').upsert(patch, { onConflict: 'user_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ config: data });
}
