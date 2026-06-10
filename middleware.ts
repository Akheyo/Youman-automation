/**
 * Basic-Auth gate for the internal sales dashboard.
 *
 * Protects `/vertrieb` and its server proxy routes `/api/vertrieb/*` — these
 * expose personal lead data (DSGVO), so they must not be public.
 *
 * Credentials come from env vars:
 *   VERTRIEB_BASIC_AUTH_USER
 *   VERTRIEB_BASIC_AUTH_PASSWORD
 *
 * Behaviour:
 *   - Both vars set    → require matching HTTP Basic Auth (401 otherwise).
 *   - Vars unset, prod → fail closed (503) so PII is never served unprotected.
 *   - Vars unset, dev  → allowed, for local convenience.
 *
 * The browser caches Basic-Auth credentials per origin, so after one prompt on
 * `/vertrieb` the same header is sent automatically to `/api/vertrieb/*`.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: ['/vertrieb', '/vertrieb/:path*', '/api/vertrieb/:path*'],
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

export function middleware(request: NextRequest): NextResponse {
  const user = process.env.VERTRIEB_BASIC_AUTH_USER;
  const pass = process.env.VERTRIEB_BASIC_AUTH_PASSWORD;

  // Not configured: protect in production (fail closed), allow in development.
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
    return NextResponse.next();
  }

  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Basic ')) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice('Basic '.length));
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(':');
  if (sep === -1) {
    return unauthorized();
  }
  const givenUser = decoded.slice(0, sep);
  const givenPass = decoded.slice(sep + 1);

  // Evaluate both comparisons regardless of the first result to avoid leaking
  // which field was wrong via timing.
  const okUser = safeEqual(givenUser, user);
  const okPass = safeEqual(givenPass, pass);
  if (!okUser || !okPass) {
    return unauthorized();
  }

  return NextResponse.next();
}
