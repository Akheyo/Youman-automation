/**
 * GET → Die Artikel-Etikettvorlagen aus Plenty, dazu die voreingestellte.
 *
 * Welche Vorlage gedruckt wird, wählt jeder Platz selbst (der Drucker hängt am
 * Platz). FOTOSTUDIO_ETIKETT_ID ist nur die Vorauswahl.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { etikettVorlagen, plentyBereit } from '@/lib/fotostudio/plenty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }

  const standard = Number(process.env.FOTOSTUDIO_ETIKETT_ID) || null;
  const plenty = await plentyBereit();
  if ('fehler' in plenty) return NextResponse.json({ vorlagen: [], standard, error: plenty.fehler }, { status: 503 });

  try {
    return NextResponse.json({ vorlagen: await etikettVorlagen(plenty.cfg), standard });
  } catch (err) {
    const text = (err as Error)?.message ?? String(err);
    return NextResponse.json({ vorlagen: [], standard, error: `Vorlagen nicht lesbar: ${text.slice(0, 200)}` }, { status: 502 });
  }
}
