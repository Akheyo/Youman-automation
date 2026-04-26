/**
 * POST /api/lead
 *
 * Validates and forwards a lead to the configured webhook.
 * If LEAD_WEBHOOK_URL is unset, returns 503 with an actionable error.
 */

import { NextResponse } from 'next/server';
import { forwardToWebhook, validateLead } from '@/lib/lead';
import type { LeadPayload } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body muss valides JSON sein.' }, { status: 400 });
  }

  const errors = validateLead(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validierung fehlgeschlagen', details: errors }, { status: 422 });
  }

  // After validation we know the shape; the cast is safe.
  const payload = body as LeadPayload;
  // Always use the server timestamp — clients can lie.
  payload.timestamp = new Date().toISOString();

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      {
        error: 'Lead-Webhook ist nicht konfiguriert.',
        action: 'LEAD_WEBHOOK_URL in Umgebungsvariablen (Vercel Project Settings) setzen.',
      },
      { status: 503 },
    );
  }

  try {
    const result = await forwardToWebhook(payload, webhookUrl, process.env.LEAD_WEBHOOK_SECRET);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: `Webhook antwortete mit HTTP ${result.status}.`,
          action: 'Webhook-URL prüfen oder beim A&B-Vertrieb melden.',
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Webhook nicht erreichbar.',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
