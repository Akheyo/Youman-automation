/**
 * GET  → der abgelegte Kategoriebaum, optional mit Vorschlägen zu einem Begriff.
 * POST → lädt den Baum bei Marktplaats neu und legt ihn ab.
 *
 * Getrennt, weil das Laden ein Dutzend API-Aufrufe kostet und der Baum sich
 * selten ändert. Wer jede Suche neu laden ließe, wartete bei jedem Tastendruck.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findeVorschlaege, holeKategorien, ladeKategorien, speichereKategorien } from '@/lib/marktplaats/kategorien';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function angemeldet(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return true;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function GET(request: Request) {
  if (!(await angemeldet())) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const suche = new URL(request.url).searchParams.get('suche') ?? '';
  const kategorien = await ladeKategorien();
  return NextResponse.json({
    anzahl: kategorien.length,
    // Ohne Suchbegriff nicht den ganzen Baum durchs Netz schieben — das sind
    // je nach Ausbaustufe mehrere tausend Zeilen.
    kategorien: suche ? [] : kategorien.slice(0, 100),
    vorschlaege: suche ? findeVorschlaege(suche, kategorien, 10) : [],
  });
}

export async function POST() {
  if (!(await angemeldet())) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  try {
    const { kategorien, diagnose } = await holeKategorien();
    const geschrieben = await speichereKategorien(kategorien);
    return NextResponse.json({
      ok: true,
      geladen: kategorien.length,
      gespeichert: geschrieben,
      offen: kategorien.filter((k) => k.offen).length,
      diagnose,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
