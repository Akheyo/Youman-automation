/**
 * Antworten und Bounces von außen melden.
 *
 *   POST /api/outreach/reply-webhook?token=<lead_webhook_token>
 *   (oder Header  x-webhook-token: <token>)
 *   Body: { email (Pflicht), kind?: 'antwort' | 'bounce', subject?, text? }
 *
 * Gedacht für einen n8n/Make-Ablauf, der das Postfach beobachtet: kommt eine
 * Antwort, wird die Sequenz für diesen Kontakt gestoppt — niemand soll ein
 * Follow-up bekommen, nachdem er schon geantwortet hat. Ein harter Bounce
 * setzt die Adresse zusätzlich auf die Sperrliste.
 *
 * Der Token ist derselbe wie beim Lead-Eingang (Einstellungen → Webhooks).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Dienst nicht konfiguriert.' }, { status: 503 });

  const url = new URL(request.url);
  const token = (url.searchParams.get('token') || request.headers.get('x-webhook-token') || '').trim();
  if (!token) return NextResponse.json({ error: 'Token fehlt.' }, { status: 401 });

  const { data: profile } = await admin.from('profiles').select('id').eq('lead_webhook_token', token).single();
  if (!profile) return NextResponse.json({ error: 'Ungültiger Token.' }, { status: 401 });
  const userId = profile.id;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email fehlt.' }, { status: 400 });
  const kind = String(body.kind ?? 'antwort') === 'bounce' ? 'bounce' : 'antwort';

  // Alle laufenden Kontakte dieses Nutzers mit dieser Adresse.
  const { data: contacts } = await admin
    .from('outreach_contacts')
    .select('id, campaign_id, current_step, status')
    .eq('user_id', userId)
    .eq('email', email)
    .in('status', ['neu', 'aktiv']);

  if (!contacts || contacts.length === 0) return NextResponse.json({ ok: true, matched: 0 });

  // Welche Kampagnen stoppen bei einer Antwort?
  const campaignIds = [...new Set(contacts.map((c) => c.campaign_id))];
  const { data: campaigns } = await admin.from('outreach_campaigns').select('id, stop_on_reply').in('id', campaignIds);
  const stopMap = new Map((campaigns ?? []).map((c) => [c.id, c.stop_on_reply !== false]));

  let updated = 0;
  for (const c of contacts) {
    const stop = kind === 'bounce' || stopMap.get(c.campaign_id) !== false;
    if (stop) {
      await admin
        .from('outreach_contacts')
        .update({ status: kind === 'bounce' ? 'bounce' : 'geantwortet', next_send_at: null })
        .eq('id', c.id);
      updated += 1;
    }
    await admin.from('outreach_events').insert({
      user_id: userId,
      campaign_id: c.campaign_id,
      contact_id: c.id,
      step_no: c.current_step,
      kind: kind === 'bounce' ? 'bounce' : 'geantwortet',
      subject: (body.subject as string) || null,
      detail: typeof body.text === 'string' ? body.text.slice(0, 2000) : null,
    });
  }

  // Unzustellbare Adressen nie wieder anschreiben.
  if (kind === 'bounce') {
    await admin
      .from('outreach_suppression')
      .upsert({ user_id: userId, email, reason: 'bounce' }, { onConflict: 'user_id,email' });
  }

  return NextResponse.json({ ok: true, matched: contacts.length, updated });
}
