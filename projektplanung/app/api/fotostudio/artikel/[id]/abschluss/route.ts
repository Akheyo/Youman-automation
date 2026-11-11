/**
 * POST → Abschluss nach der Bildübertragung.
 *
 * Fertig („in_plenty") ist der Artikel erst, wenn jedes hochgeladene Foto
 * auch in Plenty liegt. Fehlt eines, steht er als Fehler in der Liste und
 * lässt sich dort erneut anstoßen — ein Artikel mit stillschweigend fehlenden
 * Bildern war genau das, was Make produziert hat.
 */

import { NextResponse } from 'next/server';
import { leseStand, offeneBilder } from '@/lib/fotostudio/kern';
import { laufMelden } from '@/lib/fotostudio/protokoll';
import { ladeStudioArtikel } from '@/lib/fotostudio/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const zugriff = await ladeStudioArtikel(params.id);
  if (zugriff.antwort) return zugriff.antwort;
  const { supabase, artikel } = zugriff;

  const stand = leseStand(artikel.plenty);
  if (!stand.itemId) return NextResponse.json({ error: 'Der Artikel ist noch nicht in Plenty angelegt.' }, { status: 409 });

  const bilder = (artikel.bilder ?? []).filter((b) => b.hochgeladen);
  const fehlend = offeneBilder(bilder, stand).length;
  const fertig = fehlend === 0;
  const fehler = fertig ? null : `${fehlend} von ${bilder.length} Fotos nicht in Plenty — erneut versuchen.`;

  await supabase
    .from('erfassung_artikel')
    .update({
      status: fertig ? 'in_plenty' : 'fehler',
      plenty_fehler: fehler,
      plenty_am: fertig ? new Date().toISOString() : null,
    })
    .eq('id', artikel.id);

  // Nur beim ersten Abschluss melden, nicht bei jedem erneuten Versuch.
  if (artikel.status === 'anlage') await laufMelden(fertig, bilder.length, bilder.length - fehlend);

  return NextResponse.json({ fertig, fehler, itemId: stand.itemId, offen: stand.offen });
}
