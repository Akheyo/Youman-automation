/**
 * Shared dialer: places one outbound call for a lead and wires up the call row,
 * Vapi call and lead status. Used by both the manual "Anrufen" button and the
 * campaign scheduler (cron), so the behaviour stays identical.
 *
 * Quota and eligibility checks (approved, do_not_call, monthly limit) are the
 * caller's responsibility — this function just places the call.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { startVapiCall } from '@/lib/vapi';
import { DEFAULT_AGENT, type AgentConfig } from '@/lib/sales/agent';

export interface DialLead {
  id: string;
  phone: string;
  name?: string | null;
  company?: string | null;
  website?: string | null;
  notes?: string | null;
  anlass?: string | null;
  attempts?: number | null;
}

export type DialResult =
  | { ok: true; callId: string; vapiCallId: string }
  | { ok: false; error: string };

export async function placeCall(
  sb: SupabaseClient,
  opts: { userId: string; lead: DialLead; ownerName: string },
): Promise<DialResult> {
  // Load the user's Lina config (fall back to defaults).
  const { data: cfgRow } = await sb.from('agent_config').select('*').eq('user_id', opts.userId).single();
  const cfg: AgentConfig = { ...DEFAULT_AGENT, ...(cfgRow ?? {}) };

  // Pre-create the call row so the webhook can attach transcript/outcome later.
  const { data: callRow, error: callErr } = await sb
    .from('calls')
    .insert({
      user_id: opts.userId,
      lead_id: opts.lead.id,
      status: 'gestartet',
      recorded: cfg.record_calls !== false,
      disclosed: true, // KI-Offenlegung ist Pflicht und nicht abschaltbar
    })
    .select()
    .single();
  if (callErr || !callRow) return { ok: false, error: callErr?.message ?? 'Anruf konnte nicht angelegt werden.' };

  try {
    const { id: vapiId } = await startVapiCall({
      cfg,
      lead: {
        phone: opts.lead.phone,
        name: opts.lead.name,
        company: opts.lead.company,
        website: opts.lead.website,
        notes: opts.lead.notes,
        anlass: opts.lead.anlass,
      },
      ownerName: opts.ownerName,
      metadata: { userId: opts.userId, leadId: opts.lead.id, callId: callRow.id },
    });
    await sb.from('calls').update({ vapi_call_id: vapiId, status: 'laufend' }).eq('id', callRow.id);
    await sb
      .from('call_leads')
      .update({ status: 'anruf', attempts: (opts.lead.attempts ?? 0) + 1 })
      .eq('id', opts.lead.id);
    return { ok: true, callId: callRow.id, vapiCallId: vapiId };
  } catch (e) {
    await sb.from('calls').update({ status: 'fehler', summary: String(e) }).eq('id', callRow.id);
    return { ok: false, error: 'Anruf konnte nicht gestartet werden.' };
  }
}
