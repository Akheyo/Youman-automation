/**
 * GET  → prüft den hinterlegten Marktplaats-Zugang.
 * POST → prüft die im Formular eingetippten Werte, ohne sie zu speichern.
 *
 * Der POST geht bewusst am Zwischenspeicher vorbei: Sonst meldete der Test
 * „erfolgreich", weil vorhin schon jemand angemeldet war — derselbe Fallstrick
 * wie beim Plenty-Test nebenan.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { testeVerbindung, vergissToken } from '@/lib/marktplaats/client';
import { mitVorgaben, type Umgebung } from '@/lib/einstellungen/marktplaats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function angemeldet(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return true; // offener Modus ohne Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function GET() {
  if (!(await angemeldet())) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  const ergebnis = await testeVerbindung();
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 502 });
}

export async function POST(request: Request) {
  if (!(await angemeldet())) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    clientId?: string;
    clientSecret?: string;
    umgebung?: Umgebung;
    apiUrl?: string;
    postleitzahl?: string;
  };

  vergissToken();
  const ergebnis = await testeVerbindung(
    mitVorgaben({
      clientId: (body.clientId ?? '').trim(),
      clientSecret: body.clientSecret ?? '',
      umgebung: body.umgebung === 'sandbox' ? 'sandbox' : 'produktion',
      apiUrl: (body.apiUrl ?? '').trim(),
      authUrl: '',
      postleitzahl: (body.postleitzahl ?? '').trim(),
      versandEuro: null,
    }),
  );
  // Nach dem Test das Test-Token wegwerfen, damit der normale Betrieb sich
  // wieder mit dem gespeicherten Zugang anmeldet.
  vergissToken();
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 502 });
}
