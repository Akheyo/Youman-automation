/**
 * POST → ein Häppchen des Abgleichs Plenty → Marktplaats.
 *
 * DIESER VORGANG VERÖFFENTLICHT UND LÖSCHT ANZEIGEN. Deshalb:
 *
 *   - Ohne ausdrückliches `probelauf: false` wird nichts verändert.
 *   - Zum Schreiben muss zusätzlich `bestaetigung: "VEROEFFENTLICHEN"` im
 *     Körper stehen. Das ist dieselbe Sicherung wie beim Umbuchen von Beständen
 *     („BUCHEN") und aus demselben Grund: Ein versehentlich abgeschickter
 *     Aufruf soll nicht das halbe Lager online stellen.
 *   - Eine Obergrenze je Lauf begrenzt, was ein Irrtum anrichtet.
 *
 * Der Lauf antwortet mit `weiter`; die Oberfläche hängt so lange an, bis dort
 * null steht.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gleicheAb } from '@/lib/marktplaats/abgleich';
import { zaehleSpiegel } from '@/lib/marktplaats/spiegel';
import { FREIGABEWORT } from '@/lib/marktplaats/freigabe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Obergrenze, die auch im kleinsten Vercel-Tarif erlaubt ist — wie bei der
// Bilderkennung. Das Zeitbudget des Laufs liegt bewusst darunter.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    probelauf?: boolean;
    bestaetigung?: string;
    seite?: number;
    proSeite?: number;
    maxSchreibend?: number;
    uebersetzen?: boolean;
    maxBilder?: number;
  };

  const willSchreiben = body.probelauf === false;
  if (willSchreiben && body.bestaetigung !== FREIGABEWORT) {
    return NextResponse.json(
      {
        error: `Zum Schreiben fehlt die Bestätigung. Erwartet wird bestaetigung: "${FREIGABEWORT}".`,
      },
      { status: 400 },
    );
  }

  const ergebnis = await gleicheAb({
    probelauf: !willSchreiben,
    seite: body.seite,
    proSeite: body.proSeite,
    maxSchreibend: body.maxSchreibend,
    uebersetzen: body.uebersetzen,
    maxBilder: body.maxBilder,
    // Unter dem Funktionslimit bleiben: Was nicht fertig wird, holt der
    // nächste Aufruf.
    budgetMs: 45_000,
  });

  return NextResponse.json(
    { ...ergebnis, bestand: await zaehleSpiegel() },
    { status: ergebnis.ok ? 200 : 400 },
  );
}
