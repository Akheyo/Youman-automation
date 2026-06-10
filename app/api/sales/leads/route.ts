/**
 * GET  → list the user's phone leads (newest first).
 * POST → add a single lead manually. Body: { name?, company?, phone, website?, email?, notes?, interest? }
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

  const { data } = await supabase.from('call_leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return NextResponse.json({ leads: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const phone = (body.phone ?? '').replace(/[^\d+]/g, '');
  if (phone.length < 6) return NextResponse.json({ error: 'Bitte eine gültige Telefonnummer angeben.' }, { status: 400 });

  // A lead added by hand is one the owner chose → counts as approved.
  const interest = body.interest === 'high' || body.interest === 'warm' ? body.interest : 'unknown';
  const { data, error } = await supabase
    .from('call_leads')
    .insert({
      user_id: user.id,
      name: body.name || null,
      company: body.company || null,
      phone,
      website: body.website || null,
      email: body.email || null,
      notes: body.notes || null,
      source: 'manual',
      interest,
      approved: true,
      needs_approval: false,
      status: 'bereit',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data });
}
