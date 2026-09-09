/**
 * Refreshes the Supabase auth session on each request and guards the SaaS
 * area. Public routes pass through; `/felix` and `/dashboard` require a login.
 *
 * No-op when Supabase is unconfigured, so the site stays up during rollout.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/felix', '/dashboard', '/account', '/sales', '/outreach', '/leads', '/follow-ups', '/verlaeufe', '/einstellungen', '/systemcheck'];

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('redirect', path);
    return NextResponse.redirect(redirect);
  }

  if (user && (path === '/login' || path === '/signup')) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/felix';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}
