/**
 * GET → Google OAuth callback. Exchanges the code for a refresh token and
 *       stores it (service role) so the webhook can book on the user's behalf.
 */

import { NextResponse } from 'next/server';
import { exchangeCode, fetchGoogleEmail } from '@/lib/google';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state');
  const base = process.env.APP_URL || url.origin;

  if (!code || !userId) return NextResponse.redirect(new URL('/sales?google=error', base));

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      // Google only returns a refresh token on first consent; force re-consent worked via prompt=consent.
      return NextResponse.redirect(new URL('/sales?google=noretoken', base));
    }
    const email = await fetchGoogleEmail(tokens.access_token);
    const admin = createAdminClient();
    if (!admin) return NextResponse.redirect(new URL('/sales?google=error', base));

    await admin.from('google_tokens').upsert(
      { user_id: userId, refresh_token: tokens.refresh_token, calendar_id: 'primary', email, connected_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    return NextResponse.redirect(new URL('/sales?google=connected', base));
  } catch {
    return NextResponse.redirect(new URL('/sales?google=error', base));
  }
}
