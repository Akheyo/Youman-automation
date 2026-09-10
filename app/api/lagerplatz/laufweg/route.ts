/**
 * POST → Den Kommissionier-Laufweg ordnen (Positionen der Struktur-Knoten).
 *
 * ACHTUNG: Ohne `probelauf: false` wird NICHTS geschrieben. Geschrieben wird
 * ausschliesslich das Feld `position` der Knoten — kein Bestand bewegt sich,
 * nichts wird umbenannt, nichts gelöscht. Ein zweiter Lauf ändert nichts mehr.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ordneLaufweg } from '@/lib/plenty/laufweg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Keine gültigen Daten empfangen.' }, { status: 400 });
  }

  const warehouseId = Number(body.warehouseId);
  if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
    return NextResponse.json({ error: 'warehouseId fehlt.' }, { status: 400 });
  }

  const ergebnis = await ordneLaufweg({
    warehouseId,
    // Schreiben nur, wenn ausdrücklich verlangt.
    probelauf: body.probelauf !== false,
    maxSchreiben: Math.min(2000, Number(body.maxSchreiben) > 0 ? Number(body.maxSchreiben) : 500),
    // Etwas unter maxDuration, damit die Antwort noch sauber rausgeht.
    budgetMs: 45_000,
  });

  return NextResponse.json(ergebnis, { status: ergebnis.error ? 502 : 200 });
}
