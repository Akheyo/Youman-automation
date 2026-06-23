/**
 * Vapi webhook. Handles, during and after a call:
 *
 *   tool-calls          → Lina asks for free slots / books a meeting. We answer
 *                          synchronously so she can speak the result.
 *   end-of-call-report  → store the transcript, summary, recording, outcome and
 *                          update the lead status.
 *
 * Runs with the service-role client (no user session). The user is identified
 * via the metadata we attached when starting the call.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findFreeSlots, bookEvent } from '@/lib/google';
import { extractCallData, type CallOutcome } from '@/lib/sales/extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface VapiMeta {
  userId?: string;
  leadId?: string;
  callId?: string;
}

function metaOf(message: any): VapiMeta {
  return (message?.call?.metadata ?? message?.call?.assistant?.metadata ?? message?.metadata ?? {}) as VapiMeta;
}

async function googleFor(admin: ReturnType<typeof createAdminClient>, userId: string) {
  if (!admin) return null;
  const { data } = await admin.from('google_tokens').select('refresh_token, calendar_id').eq('user_id', userId).single();
  return data ?? null;
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  const payload = (await request.json().catch(() => ({}))) as any;
  const message = payload?.message ?? payload;
  const type: string = message?.type ?? '';
  const meta = metaOf(message);

  // ---- Live tool calls (availability / booking) -------------------------
  if (type === 'tool-calls' || type === 'function-call' || type === 'tool_calls') {
    const calls: any[] = message.toolCallList ?? message.toolCalls ?? (message.functionCall ? [{ id: 'fc', function: message.functionCall }] : []);
    const results: { toolCallId: string; result: string }[] = [];

    for (const c of calls) {
      const id = c.id ?? c.toolCallId ?? 'fc';
      const name = c.function?.name ?? c.name;
      let args: any = c.function?.arguments ?? c.arguments ?? {};
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }

      try {
        const g = meta.userId ? await googleFor(admin, meta.userId) : null;

        if (name === 'verfuegbarkeit_pruefen') {
          if (!g) {
            results.push({ toolCallId: id, result: 'Der Kalender ist noch nicht verbunden. Biete an, dich später per E-Mail zu melden.' });
            continue;
          }
          const slots = await findFreeSlots(g.refresh_token, g.calendar_id, { count: 3 });
          const text = slots.length
            ? 'Freie Termine: ' + slots.map((s) => `${s.label} (ISO: ${s.start})`).join('; ')
            : 'In den nächsten Tagen sind leider keine freien Termine verfügbar.';
          results.push({ toolCallId: id, result: text });
        } else if (name === 'termin_buchen') {
          if (!g) {
            results.push({ toolCallId: id, result: 'Buchung aktuell nicht möglich, der Kalender ist nicht verbunden.' });
            continue;
          }
          if (!args.start_iso) {
            results.push({ toolCallId: id, result: 'Es fehlt die Startzeit. Frag nach einem konkreten Termin.' });
            continue;
          }
          const ev = await bookEvent(g.refresh_token, g.calendar_id, {
            startIso: args.start_iso,
            summary: `Kennenlern-Termin: ${args.name ?? 'Interessent'}`,
            description: `Termin von Lina vereinbart.\nKontakt: ${args.name ?? ''} ${args.email ?? ''}`.trim(),
            attendeeEmail: args.email || undefined,
          });
          if (admin && meta.userId) {
            await admin.from('meetings').insert({
              user_id: meta.userId,
              lead_id: meta.leadId ?? null,
              call_id: meta.callId ?? null,
              contact_name: args.name ?? null,
              phone: null,
              requested_time: args.start_iso,
              status: 'gebucht',
            });
            if (meta.callId) await admin.from('calls').update({ outcome: 'termin' }).eq('id', meta.callId);
            if (meta.leadId) await admin.from('call_leads').update({ status: 'erledigt' }).eq('id', meta.leadId);
          }
          results.push({ toolCallId: id, result: `Termin gebucht für ${args.start_iso}. Bestätige ihn mündlich. Link: ${ev.htmlLink}` });
        } else {
          results.push({ toolCallId: id, result: 'Unbekanntes Werkzeug.' });
        }
      } catch (e) {
        results.push({ toolCallId: id, result: `Es gab ein technisches Problem (${String(e).slice(0, 120)}). Biete an, dich per E-Mail zu melden.` });
      }
    }

    return NextResponse.json({ results });
  }

  // ---- End-of-call report ----------------------------------------------
  if (type === 'end-of-call-report' && admin && meta.callId) {
    const transcript: string = message.transcript ?? message.artifact?.transcript ?? '';
    const summary: string = message.analysis?.summary ?? message.summary ?? '';
    const recording: string | null = message.recordingUrl ?? message.artifact?.recordingUrl ?? null;
    const duration: number | null = message.durationSeconds ? Math.round(message.durationSeconds) : null;
    const endedReason: string = message.endedReason ?? '';

    // Coarse signal from the call metadata (fallback if the LLM can't run).
    let coarse: CallOutcome | undefined;
    const low = `${summary} ${transcript}`.toLowerCase();
    if (endedReason.includes('voicemail')) coarse = 'mailbox';
    else if (endedReason.includes('no-answer') || endedReason.includes('busy')) coarse = 'nicht_erreicht';
    else if (low.includes('kein interesse') || low.includes('nicht interessiert')) coarse = 'kein_interesse';

    const { data: existing } = await admin.from('calls').select('outcome').eq('id', meta.callId).single();

    // Phase B: structured extraction from the transcript (outcome + sales vars).
    const extracted = await extractCallData(transcript, summary, coarse);
    const finalOutcome: string | null = (existing?.outcome as string) || extracted?.outcome || coarse || null;

    await admin
      .from('calls')
      .update({
        status: 'beendet',
        transcript,
        summary,
        recording_url: recording,
        duration_sec: duration,
        outcome: finalOutcome,
        extracted: extracted ?? null,
        ended_at: new Date().toISOString(),
      })
      .eq('id', meta.callId);

    // Update lead status / follow-up logic when the call ended without a booking.
    if (meta.leadId && !existing?.outcome) {
      const patch: Record<string, unknown> = {};
      switch (finalOutcome) {
        case 'kein_interesse':
          // Widerspruch → sofort dauerhaft auf die Sperrliste (§ 7 UWG).
          patch.status = 'kein_interesse';
          patch.do_not_call = true;
          patch.follow_up_at = null;
          patch.follow_up_note = null;
          break;
        case 'nicht_erreicht':
        case 'mailbox':
          patch.status = 'nicht_erreicht';
          patch.follow_up_at = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
          patch.follow_up_note = 'Automatischer Rückruf — beim ersten Versuch nicht erreicht.';
          break;
        case 'rueckruf':
          patch.status = 'nicht_erreicht';
          patch.follow_up_at = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
          patch.follow_up_note = 'Rückruf gewünscht.';
          break;
        default:
          patch.status = 'erledigt';
      }
      // Kein Interesse / Widerspruch → sofort dauerhaft auf die Sperrliste (§ 7 UWG).
      if (leadStatus === 'kein_interesse') {
        patch.do_not_call = true;
        patch.follow_up_at = null;
        patch.follow_up_note = null;
      }
      await admin.from('call_leads').update(patch).eq('id', meta.leadId);
    }

    return NextResponse.json({ ok: true });
  }

  // ---- Status updates / everything else --------------------------------
  if (type === 'status-update' && admin && meta.callId && message.status) {
    const map: Record<string, string> = { queued: 'gestartet', ringing: 'laufend', 'in-progress': 'laufend', forwarding: 'laufend', ended: 'beendet' };
    const status = map[message.status as string];
    if (status) await admin.from('calls').update({ status }).eq('id', meta.callId);
  }

  return NextResponse.json({ ok: true });
}
