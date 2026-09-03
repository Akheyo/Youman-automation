/**
 * Die kontoweite Sperrliste — wer hier steht, bekommt aus keiner Kampagne mehr
 * Post (Art. 21 DSGVO / § 7 UWG). Wird automatisch beim Abmelden und bei harten
 * Bounces gefüllt und lässt sich hier einsehen und von Hand pflegen.
 *
 * GET    → Liste.
 * POST   → { emails: [...] } oder { email } aufnehmen; laufende Sequenzen an
 *          diese Adressen werden sofort gestoppt.
 * DELETE → ?email=... wieder freigeben.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEmail } from '@/lib/outreach/template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data } = await supabase
    .from('outreach_suppression')
    .select('email, reason, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1000);
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = Array.isArray(body.emails) ? body.emails : body.email ? [body.email] : [];
  const emails = [...new Set(raw.map((e) => String(e).trim().toLowerCase()).filter(isEmail))];
  if (emails.length === 0) return NextResponse.json({ error: 'Keine gültige Adresse übergeben.' }, { status: 400 });

  const reason = String(body.reason ?? 'manuell');
  const { error } = await supabase
    .from('outreach_suppression')
    .upsert(emails.map((email) => ({ user_id: user.id, email, reason })), { onConflict: 'user_id,email' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Laufende Sequenzen an diese Adressen sofort anhalten.
  const { count } = await supabase
    .from('outreach_contacts')
    .update({ status: 'abgemeldet', next_send_at: null }, { count: 'exact' })
    .eq('user_id', user.id)
    .in('email', emails)
    .in('status', ['neu', 'aktiv']);

  return NextResponse.json({ added: emails.length, stopped: count ?? 0 });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const email = (new URL(request.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email fehlt.' }, { status: 400 });

  const { error } = await supabase.from('outreach_suppression').delete().eq('user_id', user.id).eq('email', email);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
