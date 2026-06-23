/**
 * GET → the user's eBay listing config + connection status (defaults on first read).
 * PUT → update the config. Body: partial config fields.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ebayConfigured, ebayEnv } from '@/lib/ebay/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  enabled: false,
  sheet_csv_url: '',
  marketplace_id: 'EBAY_DE',
  currency: 'EUR',
  default_category_id: '',
  default_condition: 'NEW',
  fulfillment_policy_id: '',
  payment_policy_id: '',
  return_policy_id: '',
  merchant_location_key: '',
  auto_publish: true,
};

const EDITABLE = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[];

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const [{ data: config }, { data: token }] = await Promise.all([
    supabase.from('ebay_config').select('*').eq('user_id', user.id).single(),
    supabase.from('ebay_tokens').select('connected_at, environment, expires_at').eq('user_id', user.id).single(),
  ]);

  return NextResponse.json({
    config: config ?? { user_id: user.id, ...DEFAULTS },
    connected: Boolean(token),
    connection: token ?? null,
    appConfigured: ebayConfigured(),
    environment: ebayEnv(),
  });
}

export async function PUT(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  for (const key of EDITABLE) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await supabase.from('ebay_config').upsert(patch, { onConflict: 'user_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ config: data });
}
