/**
 * Edge middleware: refresh the Supabase auth session and protect the SaaS
 * area (`/felix`, `/dashboard`, `/account`, …) behind a login.
 *
 * Supabase: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import type { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export const config = {
  // Run on all routes except static assets and image files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)'],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  return updateSession(request);
}
