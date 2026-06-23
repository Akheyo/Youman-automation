/**
 * POST → start an outbound AI call for a lead. Body: { leadId }.
 *
 * Guards: lead must be approved (or not flagged needs_approval), Vapi must be
 * configured, and the monthly call quota must not be exhausted.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startVapiCall, vapiConfigured } from '@/lib/vapi';
import { DEFAULT_AGENT, type AgentConfig } from '@/lib/sales/agent';
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

  // Load the Soul config (fall back to defaults).
  const { data: cfgRow } = await supabase.from('agent_config').select('*').eq('user_id', user.id).single();
  const cfg: AgentConfig = { ...DEFAULT_AGENT, ...(cfgRow ?? {}) };

  // Pre-create the call row so the webhook can attach transcript/outcome later.
  const { data: callRow, error: callErr } = await supabase
    .from('calls')
    .insert({
      user_id: user.id,
      lead_id: lead.id,
      status: 'gestartet',
      recorded: cfg.record_calls !== false,
      disclosed: true, // KI-Offenlegung ist pflicht und nicht abschaltbar
    })
    .select()
    .single();
  if (callErr || !callRow) return NextResponse.json({ error: callErr?.message ?? 'Anruf konnte nicht angelegt werden.' }, { status: 400 });

  try {
    const { id: vapiId } = await startVapiCall({
      cfg,
      lead: { phone: lead.phone, name: lead.name, company: lead.company, website: lead.website, notes: lead.notes, anlass: lead.anlass },
      ownerName: profile?.full_name || 'Youman Automation',
      metadata: { userId: user.id, leadId: lead.id, callId: callRow.id },
    });
    await supabase.from('calls').update({ vapi_call_id: vapiId, status: 'laufend' }).eq('id', callRow.id);
    await supabase.from('call_leads').update({ status: 'anruf' }).eq('id', lead.id);
    return NextResponse.json({ ok: true, callId: callRow.id, vapiCallId: vapiId });
  } catch (e) {
    await supabase.from('calls').update({ status: 'fehler', summary: String(e) }).eq('id', callRow.id);
    return NextResponse.json({ error: 'Anruf konnte nicht gestartet werden.', detail: String(e) }, { status: 502 });
  }
}
