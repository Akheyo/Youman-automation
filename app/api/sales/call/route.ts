/**
 * POST → start an outbound AI call for a lead. Body: { leadId }.
 *
 * Guards: lead must be approved (or not flagged needs_approval), Vapi must be
 * configured, and the monthly call quota must not be exhausted.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vapiConfigured } from '@/lib/vapi';
import { placeCall } from '@/lib/sales/dialer';
import { planForUser, isOwnerEmail } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  if (!vapiConfigured()) {
    return NextResponse.json({ error: 'Telefonie (Vapi) ist noch nicht konfiguriert.' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { leadId?: string };
  if (!body.leadId) return NextResponse.json({ error: 'leadId fehlt.' }, { status: 400 });

  const { data: lead } = await supabase.from('call_leads').select('*').eq('id', body.leadId).eq('user_id', user.id).single();
  if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden.' }, { status: 404 });
  if (lead.do_not_call) {
    return NextResponse.json({ error: 'Dieser Lead steht auf der Sperrliste (Do-Not-Call) und darf nicht angerufen werden.' }, { status: 403 });
  }
  if (lead.needs_approval && !lead.approved) {
    return NextResponse.json({ error: 'Dieser Lead muss erst freigegeben werden.' }, { status: 403 });
  }

  // Monthly call quota — owners are unlimited and skip the check entirely.
  const { data: profile } = await supabase.from('profiles').select('plan, full_name').eq('id', user.id).single();
  const plan = planForUser({ plan: profile?.plan, email: user.email });
  if (!isOwnerEmail(user.email)) {
    const { data: allowed, error: quotaErr } = await supabase.rpc('consume_quota', { p_kind: 'call', p_limit: plan.calls });
    if (!quotaErr && allowed === false) {
      return NextResponse.json({ error: `Anruf-Limit für diesen Monat erreicht (${plan.calls}). Bitte Tarif upgraden.` }, { status: 402 });
    }
  }

  const result = await placeCall(supabase, {
    userId: user.id,
    lead,
    ownerName: profile?.full_name || 'Youman Automation',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, callId: result.callId, vapiCallId: result.vapiCallId });
}
