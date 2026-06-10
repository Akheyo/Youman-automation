/**
 * Edge middleware. Two responsibilities:
 *
 *  1. `/vertrieb` + `/api/vertrieb/*` — HTTP Basic-Auth gate for the internal
 *     sales dashboard (exposes personal lead data / DSGVO).
 *  2. Everything else — refresh the Supabase auth session and protect the SaaS
 *     area (`/felix`, `/dashboard`, `/account`) behind a login.
 *
 * Basic-Auth credentials:  VERTRIEB_BASIC_AUTH_USER / VERTRIEB_BASIC_AUTH_PASSWORD
 * Supabase:                NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export const config = {
  // Run on all routes except static assets and image files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)'],
};

/** Length-independent constant-time string compare (Edge runtime: no node crypto). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse('Authentifizierung erforderlich.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="A&B Vertrieb", charset="UTF-8"' },
  });
}

/** Returns a response when the request should be blocked, or null when allowed. */
function vertriebGate(request: NextRequest): NextResponse | null {
  const user = process.env.VERTRIEB_BASIC_AUTH_USER;
  const pass = process.env.VERTRIEB_BASIC_AUTH_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'Vertriebs-Dashboard ist nicht abgesichert.',
          action: 'VERTRIEB_BASIC_AUTH_USER und VERTRIEB_BASIC_AUTH_PASSWORD in den Umgebungsvariablen setzen.',
        },
        { status: 503 },
      );
    }
    return null;
  }

  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Basic ')) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice('Basic '.length));
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(':');
  if (sep === -1) return unauthorized();

  const okUser = safeEqual(decoded.slice(0, sep), user);
  const okPass = safeEqual(decoded.slice(sep + 1), pass);
  if (!okUser || !okPass) return unauthorized();

  return null;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  if (path === '/vertrieb' || path.startsWith('/vertrieb/') || path.startsWith('/api/vertrieb')) {
    const blocked = vertriebGate(request);
    return blocked ?? NextResponse.next();
  }

  return updateSession(request);
}
