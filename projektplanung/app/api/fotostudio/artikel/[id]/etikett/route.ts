/**
 * GET ?vorlage=<labelId>&anzahl=<n> → Das Etikett aus Plenty als PDF, eine
 * Seite je Stück.
 *
 * Gedruckt wird damit genau das, was Plenty aus seiner Vorlage macht — mit der
 * EAN, die an der Variante hängt. Die App zeichnet nichts selbst.
 */

import { NextResponse } from 'next/server';
import { MAX_ETIKETTEN, etikettAnzahl } from '@/lib/fotostudio/etikett';
import { leseStand } from '@/lib/fotostudio/kern';
import { etikettVonPlenty, plentyBereit, vervielfachen } from '@/lib/fotostudio/plenty';
import { ladeStudioArtikel } from '@/lib/fotostudio/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const zugriff = await ladeStudioArtikel(params.id);
  if (zugriff.antwort) return zugriff.antwort;
  const { artikel } = zugriff;

  const stand = leseStand(artikel.plenty);
  if (!stand.itemId || !stand.variationId) {
    return NextResponse.json({ error: 'Der Artikel ist noch nicht in Plenty angelegt.' }, { status: 409 });
  }

  const suche = new URL(request.url).searchParams;
  const vorlage = Number(suche.get('vorlage')) || Number(process.env.FOTOSTUDIO_ETIKETT_ID) || 0;
  if (!vorlage) {
    return NextResponse.json({ error: 'Keine Plenty-Etikettvorlage gewählt (FOTOSTUDIO_ETIKETT_ID).' }, { status: 400 });
  }
  const anzahl = Math.min(etikettAnzahl(Number(suche.get('anzahl')) || artikel.bestand), MAX_ETIKETTEN);

  const plenty = await plentyBereit();
  if ('fehler' in plenty) return NextResponse.json({ error: plenty.fehler }, { status: 503 });

  try {
    const einzeln = await etikettVonPlenty(stand.itemId, stand.variationId, vorlage, plenty.cfg);
    const pdf = await vervielfachen(einzeln, anzahl);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etikett-${stand.itemId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const text = (err as Error)?.message ?? String(err);
    return NextResponse.json({ error: `Etikett nicht erzeugt: ${text.slice(0, 300)}` }, { status: 502 });
  }
}
