/**
 * GET → eBay OAuth callback. Exchanges the code for a refresh token and stores
 *       it (service role) so the cron can list on the user's behalf.
 *
 * eBay redirects here via the RuName configured in the developer portal; point
 * that RuName's "Your auth accepted URL" at {APP_URL}/api/ebay/callback.
 */

import { NextResponse } from 'next/server';
import { exchangeCode, ebayEnv } from '@/lib/ebay/oauth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state');
  const base = process.env.APP_URL || url.origin;

  // eBay sends ?error=... when the user declines consent.
  if (url.searchParams.get('error')) return NextResponse.redirect(new URL('/ebay?ebay=denied', base));
  if (!code || !userId) return NextResponse.redirect(new URL('/ebay?ebay=error', base));

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return NextResponse.redirect(new URL('/ebay?ebay=noretoken', base));

    const admin = createAdminClient();
    if (!admin) return NextResponse.redirect(new URL('/ebay?ebay=error', base));

    const expiresAt = tokens.refresh_token_expires_in
      ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
      : null;

    await admin.from('ebay_tokens').upsert(
      { user_id: userId, refresh_token: tokens.refresh_token, environment: ebayEnv(), expires_at: expiresAt, connected_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    return NextResponse.redirect(new URL('/ebay?ebay=connected', base));
  } catch {
    return NextResponse.redirect(new URL('/ebay?ebay=error', base));
  }
}
