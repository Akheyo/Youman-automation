/**
 * POST → Falsch angelegte Lagerorte samt Struktur wieder entfernen.
 *
 * ACHTUNG: Ohne `probelauf: false` wird NICHTS gelöscht. Gelöscht wird nur,
 * was nachweislich nicht in den Baum gehört — oberste Knoten, deren Name
 * nicht mit dem Kürzel ihrer Spalte beginnt ("1" statt "H1") — und auch das
 * nur, wenn auf keinem der Lagerorte Bestand liegt.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { raeumeAuf } from '@/lib/plenty/lagerort-aufraeumen';

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

  const ergebnis = await raeumeAuf({
    warehouseId,
    // Löschen nur, wenn ausdrücklich verlangt.
    probelauf: body.probelauf !== false,
    maxLoeschungen: Math.min(2000, Number(body.maxLoeschungen) > 0 ? Number(body.maxLoeschungen) : 500),
    budgetMs: 45_000,
    nurWurzeln: Array.isArray(body.nurWurzeln) ? body.nurWurzeln.map(Number).filter(Number.isFinite) : undefined,
  });

  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 502 });
}
