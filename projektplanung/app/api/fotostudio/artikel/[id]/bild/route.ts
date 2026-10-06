/**
 * POST { bildId } → Ein Foto nach Plenty übertragen und an die Variante hängen.
 *
 * Einzeln, damit jedes Foto seine eigenen 60 Sekunden hat und die Oberfläche
 * zeigen kann, wie viele schon oben sind. Ein bereits übertragenes Foto wird
 * nicht noch einmal geschickt.
 */

import { NextResponse } from 'next/server';
import { adminOderFehler, ansichtsLinks } from '@/lib/erfassung/speicher';
import { bildDateiname, leseStand } from '@/lib/fotostudio/kern';
import { bildUebertragen, plentyBereit } from '@/lib/fotostudio/plenty';
import { ladeStudioArtikel } from '@/lib/fotostudio/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const zugriff = await ladeStudioArtikel(params.id);
  if (zugriff.antwort) return zugriff.antwort;
  const { supabase, artikel } = zugriff;

  const { bildId } = (await request.json().catch(() => ({}))) as { bildId?: string };
  const bild = (artikel.bilder ?? []).find((b) => b.id === bildId);
  if (!bild) return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 });
  if (!bild.hochgeladen) return NextResponse.json({ error: 'Das Foto ist noch nicht hochgeladen.' }, { status: 409 });

  const stand = leseStand(artikel.plenty);
  if (!stand.itemId || !stand.variationId) {
    return NextResponse.json({ error: 'Der Artikel ist noch nicht in Plenty angelegt.' }, { status: 409 });
  }
  if (bild.id in stand.bilder) return NextResponse.json({ imageId: stand.bilder[bild.id], schonOben: true });

  const plenty = await plentyBereit();
  if ('fehler' in plenty) return NextResponse.json({ error: plenty.fehler }, { status: 503 });

  const admin = adminOderFehler();
  if ('fehler' in admin) return NextResponse.json({ error: admin.fehler }, { status: 503 });
  const url = (await ansichtsLinks(admin.admin, [bild.pfad]))[bild.pfad];
  if (!url) return NextResponse.json({ error: 'Kein Leselink für das Foto erzeugbar.' }, { status: 502 });

  // Die Reihenfolge in Plenty folgt der Aufnahme-Reihenfolge; das erste Foto
  // ist das Titelbild.
  const sortiert = [...(artikel.bilder ?? [])].filter((b) => b.hochgeladen).sort((a, b) => a.position - b.position);
  const position = Math.max(sortiert.findIndex((b) => b.id === bild.id), 0);

  try {
    const { imageId, hinweis } = await bildUebertragen(
      stand.itemId,
      stand.variationId,
      { url, dateiname: bildDateiname(artikel.nummer, position, bild.pfad), position },
      plenty.cfg,
    );

    // Frisch lesen und nur diesen Eintrag ergänzen: Laufen zwei Bilder
    // gleichzeitig, überschriebe sonst das eine den Stand des anderen.
    const { data: frisch } = await supabase.from('erfassung_artikel').select('plenty').eq('id', artikel.id).single();
    const aktuell = leseStand(frisch?.plenty ?? artikel.plenty);
    aktuell.bilder[bild.id] = imageId;
    if (hinweis) aktuell.offen.push(hinweis);
    await supabase.from('erfassung_artikel').update({ plenty: aktuell }).eq('id', artikel.id);

    return NextResponse.json({ imageId, hinweis });
  } catch (err) {
    const text = (err as Error)?.message ?? String(err);
    return NextResponse.json({ error: `Foto nicht übertragen: ${text.slice(0, 300)}` }, { status: 502 });
  }
}
