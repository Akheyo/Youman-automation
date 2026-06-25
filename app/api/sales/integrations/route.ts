/**
 * GET → the user's integration settings (inbound lead-webhook token + URL,
 *        outbound post-call webhook URL).
 * PUT → update the outbound URL, or regenerate the inbound token
 *        (body: { post_call_webhook_url? } and/or { action: 'regenerate_token' }).
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || '').replace(/\/$/, '');
}

function ingestUrl(token: string | null): string | null {
  if (!token) return null;
  const b = baseUrl();
  return `${b || ''}/api/ingest/leads?token=${token}`;
}

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data } = await supabase.from('profiles').select('lead_webhook_token, post_call_webhook_url').eq('id', user.id).single();
  return NextResponse.json({
    token: data?.lead_webhook_token ?? null,
    ingestUrl: ingestUrl(data?.lead_webhook_token ?? null),
    postCallUrl: data?.post_call_webhook_url ?? null,
  });
}

export async function PUT(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { post_call_webhook_url?: unknown; action?: unknown };
  const patch: Record<string, unknown> = {};

  if (body.action === 'regenerate_token') {
    patch.lead_webhook_token = (randomUUID() + randomUUID()).replace(/-/g, '');
  }
  if ('post_call_webhook_url' in body) {
    const url = String(body.post_call_webhook_url ?? '').trim();
    if (url && !/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'Bitte eine gültige http(s)-URL angeben.' }, { status: 400 });
    patch.post_call_webhook_url = url || null;
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nichts zu speichern.' }, { status: 400 });

  const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select('lead_webhook_token, post_call_webhook_url').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    token: data?.lead_webhook_token ?? null,
    ingestUrl: ingestUrl(data?.lead_webhook_token ?? null),
    postCallUrl: data?.post_call_webhook_url ?? null,
  });
}
