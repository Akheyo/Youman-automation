/**
 * POST → einen einzelnen Kontakt sofort bedienen, unabhängig vom Fenster.
 *   Body: { contact_id }. Gedacht für den Testversand an die eigene Adresse
 *   und für "diesen einen jetzt anschreiben". Das Monatskontingent gilt auch
 *   hier.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { planForUser } from '@/lib/plans';
import { sendNextStep } from '@/lib/outreach/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const contactId = String(body.contact_id ?? '');
  if (!contactId) return NextResponse.json({ error: 'contact_id fehlt.' }, { status: 400 });

  const [{ data: campaign }, { data: contact }, { data: profile }] = await Promise.all([
    supabase.from('outreach_campaigns').select('*').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('outreach_contacts').select('*').eq('id', contactId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('plan').eq('id', user.id).single(),
  ]);
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });
  if (!contact) return NextResponse.json({ error: 'Kontakt nicht gefunden.' }, { status: 404 });

  const plan = planForUser({ plan: profile?.plan, email: user.email });
  const { data: allowed, error: quotaErr } = await supabase.rpc('consume_quota', { p_kind: 'email', p_limit: plan.emails });
  if (!quotaErr && allowed === false) {
    return NextResponse.json({ error: `Monatslimit erreicht (${plan.emails} Mails im Tarif ${plan.name}).` }, { status: 402 });
  }

  const { data: steps } = await supabase
    .from('outreach_steps')
    .select('step_no, delay_days, subject, body')
    .eq('campaign_id', campaign.id)
    .order('step_no', { ascending: true });

  const res = await sendNextStep(supabase, { campaign, steps: steps ?? [], contact });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, step: res.step_no, subject: res.subject, done: res.done });
}
