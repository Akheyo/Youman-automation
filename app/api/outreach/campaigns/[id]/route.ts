/**
 * GET    → eine Kampagne mit Sequenz und Kennzahlen.
 * PATCH  → Einstellungen ändern; `status: 'aktiv'` startet den Versand.
 *          Beim Start werden alle noch nicht eingeplanten Kontakte terminiert.
 * DELETE → Kampagne samt Sequenz und Kontakten entfernen.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nextSendAt } from '@/lib/outreach/schedule';
import { outreachConfigured } from '@/lib/outreach/sender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS = ['entwurf', 'aktiv', 'pausiert', 'fertig'];

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  const [{ data: steps }, { data: contacts }] = await Promise.all([
    supabase.from('outreach_steps').select('*').eq('campaign_id', campaign.id).order('step_no', { ascending: true }),
    supabase.from('outreach_contacts').select('status').eq('campaign_id', campaign.id),
  ]);

  const byStatus: Record<string, number> = {};
  for (const c of contacts ?? []) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

  return NextResponse.json({ campaign, steps: steps ?? [], byStatus, senderReady: outreachConfigured() });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  for (const key of ['from_name', 'from_email', 'reply_to', 'signature'] as const) {
    if (key in body) patch[key] = String(body[key] ?? '').trim() || null;
  }
  const num = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
  };
  for (const [key, min, max] of [
    ['window_start', 0, 23],
    ['window_end', 1, 24],
    ['max_per_day', 1, 1000],
  ] as const) {
    if (key in body) {
      const v = num(body[key], min, max);
      if (v !== undefined) patch[key] = v;
    }
  }
  if ('send_on_weekend' in body) patch.send_on_weekend = body.send_on_weekend === true;
  if ('stop_on_reply' in body) patch.stop_on_reply = body.stop_on_reply !== false;
  if ('timezone' in body && String(body.timezone ?? '').trim()) patch.timezone = String(body.timezone).trim();

  const starting = STATUS.includes(String(body.status));
  if (starting) patch.status = String(body.status);

  // Startvoraussetzungen prüfen, bevor Mails rausgehen.
  if (patch.status === 'aktiv') {
    if (!outreachConfigured()) {
      return NextResponse.json({ error: 'Versand ist nicht konfiguriert (OUTREACH_WEBHOOK_URL fehlt).' }, { status: 400 });
    }
    const { count: stepCount } = await supabase
      .from('outreach_steps')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
    if ((stepCount ?? 0) === 0) return NextResponse.json({ error: 'Die Sequenz hat noch keinen Schritt.' }, { status: 400 });

    const { count: contactCount } = await supabase
      .from('outreach_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .in('status', ['neu', 'aktiv']);
    if ((contactCount ?? 0) === 0) return NextResponse.json({ error: 'Die Kampagne hat noch keine offenen Kontakte.' }, { status: 400 });
  }

  const merged = { ...campaign, ...patch };
  const { data: updated, error } = await supabase
    .from('outreach_campaigns')
    .update(patch)
    .eq('id', campaign.id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Beim Aktivieren alles einplanen, was noch keinen Termin hat.
  let scheduled = 0;
  if (patch.status === 'aktiv') {
    const { data: pending } = await supabase
      .from('outreach_contacts')
      .select('id')
      .eq('campaign_id', campaign.id)
      .in('status', ['neu', 'aktiv'])
      .is('next_send_at', null);
    for (const c of pending ?? []) {
      await supabase
        .from('outreach_contacts')
        .update({ next_send_at: nextSendAt(merged, 0).toISOString() })
        .eq('id', c.id);
      scheduled += 1;
    }
  }

  return NextResponse.json({ campaign: updated, scheduled });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { error } = await supabase.from('outreach_campaigns').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
