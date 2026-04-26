/**
 * Lead webhook helpers — schema validation + HMAC signing.
 *
 * The /api/lead route validates the incoming payload (defensively: client
 * can lie), enriches it with the server timestamp, and forwards to the
 * configured `LEAD_WEBHOOK_URL`.
 *
 * Webhook payload schema (JSON):
 *   POST <LEAD_WEBHOOK_URL>
 *   Content-Type: application/json
 *   X-Signature: sha256=<HMAC of body with LEAD_WEBHOOK_SECRET>
 *   {
 *     "name", "phone", "email", "timeframe", "message?",
 *     "address", "lat", "lng",
 *     "consumption": { ... },
 *     "calculation": { ... },
 *     "timestamp", "consent", "source"
 *   }
 */

import { createHmac } from 'node:crypto';
import type { LeadPayload } from '@/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LeadValidationError {
  field: string;
  message: string;
}

export function validateLead(payload: unknown): LeadValidationError[] {
  const errors: LeadValidationError[] = [];
  if (!payload || typeof payload !== 'object') {
    return [{ field: 'root', message: 'Payload muss ein Objekt sein.' }];
  }
  const p = payload as Record<string, unknown>;

  function need(field: string, type: 'string' | 'number' | 'boolean'): void {
    const v = p[field];
    if (typeof v !== type || (type === 'string' && (v as string).trim().length === 0)) {
      errors.push({ field, message: `Feld "${field}" ist erforderlich.` });
    }
  }

  need('name', 'string');
  need('phone', 'string');
  need('email', 'string');
  need('timeframe', 'string');
  need('address', 'string');
  need('lat', 'number');
  need('lng', 'number');
  need('source', 'string');

  if (typeof p['email'] === 'string' && !EMAIL_RE.test(p['email'] as string)) {
    errors.push({ field: 'email', message: 'Ungültige E-Mail-Adresse.' });
  }
  if (p['consent'] !== true) {
    errors.push({ field: 'consent', message: 'DSGVO-Einwilligung erforderlich.' });
  }
  if (typeof p['consumption'] !== 'object' || p['consumption'] === null) {
    errors.push({ field: 'consumption', message: 'Verbrauchsdaten fehlen.' });
  }
  if (typeof p['calculation'] !== 'object' || p['calculation'] === null) {
    errors.push({ field: 'calculation', message: 'Berechnungsergebnis fehlt.' });
  }

  return errors;
}

export function signPayload(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

export async function forwardToWebhook(
  payload: LeadPayload,
  webhookUrl: string,
  secret?: string,
): Promise<{ ok: boolean; status: number }> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Signature'] = signPayload(body, secret);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(webhookUrl, { method: 'POST', headers, body, signal: ctl.signal });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}
