/**
 * POST → Lagerplatz-Scan über die Artikel in PlentyONE (nur lesend).
 *
 * Der Scan läuft in Häppchen: Die Antwort enthält `naechsteSeite`; solange
 * dieser Wert nicht null ist, ruft die Oberfläche erneut auf und hängt die
 * Befunde an. So bleibt jeder einzelne Aufruf innerhalb des Serverless-Timeouts.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanneLagerplaetze } from '@/lib/plenty/lagerplatz-scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Ohne Body wird von vorn gescannt.
  }

  const zahl = (wert: unknown, standard: number) => {
    const n = Number(wert);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : standard;
  };

  const ergebnis = await scanneLagerplaetze({
    // Standard: nur Artikel mit Bestand. "alle" geht über den ganzen Artikelstamm.
    quelle: body.quelle === 'alle' ? 'alle' : 'bestand',
    startSeite: zahl(body.startSeite, 1),
    maxSeiten: Math.min(20, zahl(body.maxSeiten, 8)),
    proSeite: Math.min(250, zahl(body.proSeite, 100)),
    // Etwas unter maxDuration bleiben, damit die Antwort noch rausgeht.
    maxDauerMs: 45_000,
    texteNachladen: body.texteNachladen === true,
    maxNachladungen: Math.min(500, zahl(body.maxNachladungen, 150)),
    nurMitTreffer: body.nurMitTreffer === true,
  });

  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : ergebnis.konfiguriert ? 502 : 503 });
}
