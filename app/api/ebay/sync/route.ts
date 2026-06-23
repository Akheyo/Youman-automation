/**
 * GET → cron entry point (Vercel Cron hits this on a schedule). Runs the eBay
 *       listing sync for every user that has Auto-Sync enabled.
 *
 * Protected by CRON_SECRET: Vercel Cron sends it as a Bearer token; a manual
 * call must pass ?key=<CRON_SECRET>. Without the secret set the endpoint is
 * disabled (503) so it can never run unprotected in production.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncEbayForUser } from '@/lib/ebay/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get('key') === secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET nicht gesetzt — Endpoint deaktiviert.' }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Service-Role-Key fehlt.' }, { status: 503 });

  const { data: configs } = await admin.from('ebay_config').select('user_id').eq('enabled', true);
  const runs: Record<string, unknown> = {};
  for (const { user_id } of configs ?? []) {
    runs[user_id] = await syncEbayForUser(admin, user_id);
  }

  return NextResponse.json({ ran: Object.keys(runs).length, runs });
}
