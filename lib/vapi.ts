/**
 * Vapi client — places outbound AI phone calls.
 *
 * Required env:
 *   VAPI_API_KEY          private API key (server only)
 *   VAPI_PHONE_NUMBER_ID  the Vapi phone number that calls go out from
 *   APP_URL               public base URL (for the tool/webhook callback)
 */

import { buildSystemPrompt, callTools, voiceConfig, type AgentConfig, type LeadContext } from './sales/agent';

const VAPI_BASE = 'https://api.vapi.ai';

export function vapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY && process.env.VAPI_PHONE_NUMBER_ID);
}

export interface StartCallInput {
  cfg: AgentConfig;
  lead: LeadContext & { phone: string };
  ownerName: string;
  metadata: Record<string, string>; // echoed back on the webhook (e.g. userId, leadId, callId)
}

/** Create an outbound call. Returns the Vapi call id. */
export async function startVapiCall(input: StartCallInput): Promise<{ id: string }> {
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const assistant = {
    name: input.cfg.agent_name,
    firstMessage: input.cfg.opening_line,
    maxDurationSeconds: input.cfg.max_duration,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.6,
      messages: [{ role: 'system', content: buildSystemPrompt(input.cfg, input.lead, input.ownerName) }],
      tools: callTools(),
    },
    voice: voiceConfig(input.cfg.voice),
    transcriber: { provider: 'deepgram', model: 'nova-2', language: input.cfg.language || 'de' },
    server: appUrl ? { url: `${appUrl}/api/sales/vapi-webhook` } : undefined,
    metadata: input.metadata,
    analysisPlan: {
      summaryPrompt: 'Fasse das Telefonat in 2–3 deutschen Sätzen zusammen: Ergebnis, Stimmung, nächste Schritte.',
    },
  };

  const res = await fetch(`${VAPI_BASE}/call`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: { number: input.lead.phone },
      metadata: input.metadata,
      assistant,
    }),
  });
  if (!res.ok) throw new Error(`Vapi call failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}
