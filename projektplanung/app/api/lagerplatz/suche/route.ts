/**
 * POST → sucht alternative Lagerplätze für einen Artikel (nur lesend).
 *
 * Ein Aufruf, ein Ergebnis: Anders als der Scan läuft die Suche nicht in
 * Häppchen, weil sie nur wenige Artikel anfasst. Das Zeitbudget bleibt knapp
 * unter maxDuration, damit die Antwort noch rausgeht.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sucheAlternativePlaetze } from '@/lib/plenty/suche';

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
    // Ohne Body gibt es nichts zu suchen — das fängt die Prüfung unten ab.
  }

  const eingabe = typeof body.eingabe === 'string' ? body.eingabe.trim() : '';
  if (!eingabe) {
    return NextResponse.json({ error: 'Bitte eine Artikel- oder Varianten-ID angeben.' }, { status: 400 });
  }

  const zahl = (wert: unknown, standard: number) => {
    const n = Number(wert);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : standard;
  };

  const ergebnis = await sucheAlternativePlaetze({
    eingabe,
    warehouseId: zahl(body.warehouseId, 0) || null,
    idSpanne: Math.min(15, zahl(body.idSpanne, 5)),
    zeitfensterMin: Math.min(720, zahl(body.zeitfensterMin, 45)),
    mitRegalNachbarn: body.mitRegalNachbarn !== false,
    mitNamenssuche: body.mitNamenssuche !== false,
    // Etwas unter maxDuration bleiben, damit die Antwort noch durchgeht.
    maxDauerMs: 45_000,
  });

  return NextResponse.json(ergebnis, {
    status: ergebnis.ok ? 200 : ergebnis.konfiguriert ? 502 : 503,
  });
}
