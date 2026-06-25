/**
 * Inbound lead webhook — external systems (CRM, Meta Lead Ad, Zapier, n8n …)
 * POST a lead here and it lands in the user's Lina queue.
 *
 *   POST /api/ingest/leads?token=<lead_webhook_token>
 *   (or header  x-webhook-token: <token>)
 *   body: { phone (required), name?, company?, email?, website?, notes?,
 *           anlass?, campaign_id?, approved? }
 *
 * The token maps to the owning user (service-role lookup, no session).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Service nicht konfiguriert.' }, { status: 503 });

  const url = new URL(request.url);
  const token = (url.searchParams.get('token') || request.headers.get('x-webhook-token') || '').trim();
  if (!token) return NextResponse.json({ error: 'Token fehlt.' }, { status: 401 });

  const { data: profile } = await admin.from('profiles').select('id').eq('lead_webhook_token', token).single();
  if (!profile) return NextResponse.json({ error: 'Ungültiger Token.' }, { status: 401 });
  const userId = profile.id;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const phone = String(body.phone ?? '').replace(/[^\d+]/g, '');
  if (phone.length < 6) return NextResponse.json({ error: 'phone fehlt oder ist ungültig.' }, { status: 400 });

  // Optional campaign assignment (must belong to the user).
  let campaignId: string | null = null;
  if (body.campaign_id) {
    const { data: camp } = await admin.from('campaigns').select('id').eq('id', String(body.campaign_id)).eq('user_id', userId).single();
    if (camp) campaignId = camp.id;
  }

  // Dedupe by phone for this user.
  const { data: dup } = await admin.from('call_leads').select('id').eq('user_id', userId).eq('phone', phone).maybeSingle();
  if (dup) return NextResponse.json({ ok: true, leadId: dup.id, duplicate: true });

  const approved = body.approved === true || body.approved === 'true';
  const insert: Record<string, unknown> = {
    user_id: userId,
    name: (body.name as string) || null,
    company: (body.company as string) || null,
    phone,
    email: (body.email as string) || null,
    website: (body.website as string) || null,
    notes: (body.notes as string) || null,
    anlass: (body.anlass as string) || null,
    source: 'webhook',
    approved,
    needs_approval: !approved,
    status: approved ? 'bereit' : 'neu',
  };
  if (campaignId) {
    insert.campaign_id = campaignId;
    if (approved) {
      insert.attempts = 0;
      insert.next_attempt_at = new Date().toISOString();
    }
  }

  const { data, error } = await admin.from('call_leads').insert(insert).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, leadId: data?.id });
}
