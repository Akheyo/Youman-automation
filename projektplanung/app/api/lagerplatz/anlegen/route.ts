/**
 * POST → Lagerorte in PlentyONE anlegen.
 *
 * ACHTUNG: Ohne `probelauf: false` wird NICHTS geschrieben. Das ist Absicht.
 * Angelegte Lagerorte lassen sich zwar wieder löschen, aber nur einzeln —
 * eine versehentlich erzeugte Struktur wieder loszuwerden ist mühsam.
 *
 * Die Liste kommt entweder als `codes` (fertige Lagerplatz-Codes) oder als
 * `tabelle` (die Läufe-Tabelle mit Halle/Regal/Ebene/Feld/Lagerort). Beides
 * wird serverseitig noch einmal normalisiert, damit die Oberfläche nichts
 * erfinden kann.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { codesAusTabelle } from '@/lib/lagerplatz/laeufe';
import { legeLagerorteAn } from '@/lib/plenty/lagerort-anlegen';
import { leereLagerortPuffer } from '@/lib/plenty/lagerorte';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Obergrenze der Liste je Aufruf — genug für das ganze Lager auf einmal. */
const MAX_ZEILEN = 20000;

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

  let codes: string[] = [];
  let leseFehler: string[] = [];
  if (typeof body.tabelle === 'string' && body.tabelle.trim()) {
    const gelesen = codesAusTabelle(body.tabelle);
    codes = gelesen.codes;
    leseFehler = gelesen.fehler;
  } else if (Array.isArray(body.codes)) {
    codes = body.codes.map((c) => String(c).trim()).filter(Boolean);
  }

  if (!codes.length) {
    return NextResponse.json(
      { error: 'Keine brauchbaren Zeilen übergeben.', leseFehler },
      { status: 400 },
    );
  }
  if (codes.length > MAX_ZEILEN) {
    return NextResponse.json(
      { error: `Zu viele Zeilen (${codes.length}). Höchstens ${MAX_ZEILEN} je Aufruf.` },
      { status: 400 },
    );
  }

  // Fortsetzung eines abgebrochenen Laufs: ab hier weitermachen.
  const ab = Number(body.ab);
  const rest = Number.isFinite(ab) && ab > 0 ? codes.slice(Math.floor(ab)) : codes;

  const ergebnis = await legeLagerorteAn(rest, {
    warehouseId,
    // Schreiben nur, wenn ausdrücklich verlangt.
    probelauf: body.probelauf !== false,
    maxAnlagen: Math.min(1000, Number(body.maxAnlagen) > 0 ? Number(body.maxAnlagen) : 200),
    // Etwas unter maxDuration, damit die Antwort noch sauber rausgeht.
    budgetMs: 45_000,
  });

  // Neue Lagerorte heisst: die zwischengespeicherte Liste ist veraltet.
  if (ergebnis.angelegt > 0) leereLagerortPuffer(warehouseId);

  return NextResponse.json(
    {
      ...ergebnis,
      leseFehler,
      gesamtZeilen: codes.length,
      // Absolute Position in der Gesamtliste, nicht nur im Rest.
      naechsterIndex: (Number.isFinite(ab) && ab > 0 ? Math.floor(ab) : 0) + ergebnis.naechsterIndex,
    },
    { status: ergebnis.ok ? 200 : 502 },
  );
}
