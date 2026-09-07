/**
 * GET → Lager und ihre Lagerorte aus PlentyONE lesen (nur lesend).
 *
 * Ohne `warehouseId` kommt die Liste der Lager zurück. Mit `warehouseId`
 * zusätzlich, wie viele Lagerorte es dort gibt — auch die leeren.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ladeLager, ladeLagerorte, verzeichnis } from '@/lib/plenty/lagerorte';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }

  const warehouseId = Number(new URL(request.url).searchParams.get('warehouseId'));

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
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
