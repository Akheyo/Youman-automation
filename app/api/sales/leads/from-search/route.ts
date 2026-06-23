/**
 * POST → hand a company found by Felix over to Lina as a phone lead.
 * Body: { name, phone, website?, address?, descriptors? }
 *
 * These are cold leads, so they land in "needs approval" until the owner
 * clears them for calling.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const phone = String(body.phone ?? '').replace(/[^\d+]/g, '');
  if (phone.length < 6) return NextResponse.json({ error: 'Dieser Eintrag hat keine Telefonnummer.' }, { status: 400 });

  const descriptors = Array.isArray(body.descriptors) ? (body.descriptors as string[]).join(' · ') : null;
  const notes = [body.address, descriptors].filter(Boolean).join(' — ') || null;

  // "Anlass": the factual reason this company is a fit (compliance basis + pitch).
  const hasWebsite = Boolean(body.website);
  const anlass =
    String(body.anlass ?? '').trim() ||
    (!hasWebsite
      ? 'Keine Website hinterlegt — Bedarf an Web-/Automationslösung wahrscheinlich.'
      : descriptors
        ? `Branche passt zum Angebot: ${descriptors}.`
        : null);

  // Avoid obvious duplicates (same phone for this user).
  const { data: dup } = await supabase.from('call_leads').select('id').eq('user_id', user.id).eq('phone', phone).maybeSingle();
  if (dup) return NextResponse.json({ lead: dup, duplicate: true });

  const { data, error } = await supabase
    .from('call_leads')
    .insert({
      user_id: user.id,
      name: String(body.name ?? '') || null,
      company: String(body.name ?? '') || null,
      phone,
      website: (body.website as string) || null,
      notes,
      anlass,
      source: 'felix',
      interest: 'unknown',
      approved: false,
      needs_approval: true,
      status: 'neu',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data });
}
