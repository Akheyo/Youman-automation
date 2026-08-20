import { NextResponse, type NextRequest } from 'next/server'

// Grobe Vorprüfung: ohne Sitzungs-Cookie gar nicht erst laden.
// Die eigentliche Pruefung passiert im Layout gegen die Datenbank.
export function middleware(request: NextRequest) {
  const hatCookie = request.cookies.has('kk_session')
  const pfad = request.nextUrl.pathname

  if (!hatCookie && pfad !== '/login') {
    const ziel = new URL('/login', request.url)
    return NextResponse.redirect(ziel)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|svg|ico)$).*)'],
}
