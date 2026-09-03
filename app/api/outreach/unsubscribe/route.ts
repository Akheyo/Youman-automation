/**
 * Abmeldung ohne Login — der Empfänger hat kein Konto in dieser App.
 *
 * POST /api/outreach/unsubscribe?token=...  → meldet sofort ab. Das ist der
 *   Endpunkt aus dem List-Unsubscribe-Header (RFC 8058, Ein-Klick aus dem
 *   Postfach) und zugleich das Ziel des Knopfes auf /abmelden/<token>.
 * GET  → leitet auf die Bestätigungsseite um, damit ein Link-Vorschau-Dienst
 *   niemanden versehentlich abmeldet.
 *
 * Die Datenbankarbeit macht die Funktion `outreach_unsubscribe(token)`, damit
 * hier kein Service-Role-Zugriff auf Kontaktdaten nötig ist.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenFrom(request: Request, body?: Record<string, unknown>): string {
  const url = new URL(request.url);
  return String(url.searchParams.get('token') || body?.token || '').trim();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const token = tokenFrom(request, body);
  if (!token) return NextResponse.json({ error: 'Token fehlt.' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Dienst nicht konfiguriert.' }, { status: 503 });

  const { data, error } = await admin.rpc('outreach_unsubscribe', { p_token: token });
  if (error) return NextResponse.json({ error: 'Abmeldung fehlgeschlagen.' }, { status: 500 });
  // Unbekannter Token: trotzdem "ok" melden — sonst ließe sich über den
  // Endpunkt prüfen, welche Tokens existieren.
  return NextResponse.json({ ok: true, email: data ?? null });
}

export async function GET(request: Request) {
  const token = tokenFrom(request);
  const base = new URL(request.url).origin;
  return NextResponse.redirect(token ? `${base}/abmelden/${encodeURIComponent(token)}` : `${base}/`);
}
