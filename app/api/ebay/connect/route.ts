/**
 * GET → start the eBay OAuth consent flow. Redirects the owner to eBay; the
 *       user id is carried in `state` so the callback can store the token.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ebayAuthUrl, ebayConfigured } from '@/lib/ebay/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const base = process.env.APP_URL || new URL(request.url).origin;
  if (!ebayConfigured()) return NextResponse.redirect(new URL('/ebay?ebay=unconfigured', base));

  const supabase = createClient();
  if (!supabase) return NextResponse.redirect(new URL('/ebay?ebay=error', base));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', base));

  return NextResponse.redirect(ebayAuthUrl(user.id));
}
