/**
 * POST → Artikel ihren Lagerorten zuweisen (Umbuchung vom Standard-Lagerort).
 *
 * ACHTUNG: Ohne `probelauf: false` wird NICHTS geschrieben. Das ist Absicht —
 * die Umbuchung bewegt echten Bestand und lässt sich nur durch Zurückbuchen
 * rückgängig machen.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { weiseZu, type Wunsch } from '@/lib/plenty/zuweisung';

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

  const roh = Array.isArray(body.wuensche) ? body.wuensche : [];
  const wuensche: Wunsch[] = roh
    .map((w) => w as Record<string, unknown>)
    .filter((w) => Number(w?.variationId) > 0 && typeof w?.ziel === 'string' && w.ziel.trim())
    .slice(0, 2000)
    .map((w) => ({
      variationId: Number(w.variationId),
      itemId: Number(w.itemId) > 0 ? Number(w.itemId) : null,
      ziel: String(w.ziel).trim(),
      menge: Number(w.menge) > 0 ? Number(w.menge) : null,
    }));

  if (!wuensche.length) {
    return NextResponse.json({ error: 'Keine brauchbaren Zeilen übergeben.' }, { status: 400 });
  }

  const ergebnis = await weiseZu(wuensche, {
    warehouseId,
    // Schreiben nur, wenn ausdrücklich verlangt.
    probelauf: body.probelauf !== false,
    vonLagerortId: Number(body.vonLagerortId) >= 0 ? Number(body.vonLagerortId) : 0,
    maxBuchungen: Math.min(500, Number(body.maxBuchungen) > 0 ? Number(body.maxBuchungen) : 50),
  });

  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 502 });
}
