/**
 * GET → redirect the logged-in user to Google's consent screen so Lina can
 *       book into their calendar. The user id is carried in `state`.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { googleAuthUrl, googleConfigured } from '@/lib/google';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google Calendar ist noch nicht konfiguriert.' }, { status: 503 });
  }
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?redirect=/sales', process.env.APP_URL || 'http://localhost:3000'));

  return NextResponse.redirect(googleAuthUrl(user.id));
}
