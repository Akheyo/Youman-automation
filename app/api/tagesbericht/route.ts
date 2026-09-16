/**
 * GET → ist der Tagesbericht für dieses Konto an?
 * PUT → { enabled: boolean } — ein- oder ausschalten.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data } = await supabase.from('profiles').select('tagesbericht, email').eq('id', user.id).single();
  return NextResponse.json({ enabled: data?.tagesbericht !== false, email: data?.email ?? user.email ?? null });
}

export async function PUT(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  const enabled = body.enabled === true;
  const { error } = await supabase.from('profiles').update({ tagesbericht: enabled }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ enabled });
}
