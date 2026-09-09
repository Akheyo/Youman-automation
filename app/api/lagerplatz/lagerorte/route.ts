/**
 * GET → Lager und ihre Lagerorte aus PlentyONE lesen (nur lesend).
 *
 * Ohne `warehouseId` kommt die Liste der Lager zurück. Mit `warehouseId`
 * zusätzlich, wie viele Lagerorte es dort gibt — auch die leeren.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ladeLager, ladeLagerorte, verzeichnis } from '@/lib/plenty/lagerorte';
import { ladeStruktur, pruefeLagerort } from '@/lib/plenty/lagerort-anlegen';
import { plentyGet } from '@/lib/plenty/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const warehouseId = Number(params.get('warehouseId'));

  // Einzelabfrage zur Klärung: Wie heißt ein bestimmter Lagerort wirklich,
  // und unter welchem Pfad hängt er? Rein lesend.
  const lagerortId = Number(params.get('lagerortId'));
  if (Number.isFinite(lagerortId) && lagerortId > 0) {
    const roh = await pruefeLagerort(lagerortId);
    return NextResponse.json({ ok: !roh.fehler, lagerortId, ...roh });
  }

  // Rohe Strukturangaben eines Lagers: die Spalten (Dimensionen) mit Kürzel
  // und der Angabe, ob das Kürzel im Namen erscheint — und die obersten
  // Knoten. Daran hängt, ob ein Lagerort "H1/R7/…" oder nur "1/7/…" heißt.
  if (params.get('struktur') === '1' && Number.isFinite(warehouseId) && warehouseId > 0) {
    try {
      const dimensionen = await plentyGet<unknown>(`/rest/warehouses/${warehouseId}/locations/dimensions`);
      const { knoten, vollstaendig } = await ladeStruktur(warehouseId);
      const tiefen = new Map<number, number>();
      for (const k of knoten) tiefen.set(k.dimensionId, (tiefen.get(k.dimensionId) ?? 0) + 1);
      return NextResponse.json({
        ok: true,
        warehouseId,
        dimensionen,
        knotenGesamt: knoten.length,
        vollstaendig,
        knotenJeDimension: [...tiefen.entries()].map(([dimensionId, anzahl]) => ({ dimensionId, anzahl })),
        obersteKnoten: knoten
          .filter((k) => k.parentId === 0)
          .slice(0, 40)
          .map((k) => ({ id: k.id, name: k.name, dimensionId: k.dimensionId })),
      });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
    }
  }

  try {
    const lager = await ladeLager();
    if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
      return NextResponse.json({ ok: true, lager });
    }
    const { orte, ohneCode, abgebrochen } = await ladeLagerorte(warehouseId);
    const { nachCode, doppelt } = verzeichnis(orte);
    return NextResponse.json({
      ok: true,
      lager,
      warehouseId,
      gesamt: orte.length,
      zuordenbar: nachCode.size,
      ohneCode,
      doppelt,
      abgebrochen,
      beispiele: orte.slice(0, 10).map((o) => ({ id: o.id, name: o.name, code: o.code })),
      // Namen, die sich nicht auf die einheitliche Form bringen lassen.
      // Ohne sie lässt sich nicht erkennen, WARUM ein Platz nicht zählt —
      // etwa weil neu angelegte Lagerorte anders heißen als erwartet.
      beispieleOhneCode: orte
        .filter((o) => !o.code)
        .slice(0, 25)
        .map((o) => ({ id: o.id, name: o.name })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
