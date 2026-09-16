/**
 * POST → "Artikel fertig". Der Moment, in dem die Verarbeitung startet.
 *
 * Hier wird geprüft, ob die Pflichtaufnahmen wirklich oben sind — nicht, ob sie
 * fotografiert wurden. Ein Foto, das im Funkloch in der Warteschlange hängt,
 * zählt nicht; sonst liefe die Erkennung mit halbem Bildsatz und niemand
 * wüsste warum.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { artikelBereit, bereitHinweis } from '@/lib/erfassung/logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Optionaler Anstoß nach außen. Die Verarbeitung liest ihre Arbeit ohnehin aus
 * der Tabelle (status = 'bereit') — der Haken ist nur da, damit ein Worker
 * nicht pollen muss. Fehlt die Variable, passiert nichts, und das ist kein
 * Mangel.
 */
async function anstossen(nutzlast: unknown): Promise<string | null> {
  const url = process.env.ERFASSUNG_WEBHOOK_URL;
  if (!url) return null;
  try {
    const abbruch = AbortSignal.timeout(3000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nutzlast),
      signal: abbruch,
    });
    if (!res.ok) return `Anstoß abgelehnt (HTTP ${res.status}).`;
    return null;
  } catch (e) {
    // Der Artikel steht auf "bereit" — die Verarbeitung findet ihn auch ohne
    // Anstoß. Deshalb ist das eine Warnung, kein Fehler.
    return `Anstoß fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { notiz } = (await request.json().catch(() => ({}))) as { notiz?: string };

  const { data: artikel, error: ladeFehler } = await supabase
    .from('erfassung_artikel')
    .select('id, nummer, status, bilder:erfassung_bilder (id, rolle, hochgeladen)')
    .eq('id', params.id)
    .single();
  if (ladeFehler || !artikel) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });

  if (artikel.status !== 'offen') {
    return NextResponse.json({ error: 'Der Artikel ist bereits abgeschickt.' }, { status: 409 });
  }

  const bilder = (artikel.bilder ?? []) as Array<{ rolle: string; hochgeladen: boolean }>;
  if (!artikelBereit(bilder)) {
    return NextResponse.json({ error: bereitHinweis(bilder) ?? 'Es fehlen Pflichtaufnahmen.' }, { status: 400 });
  }

  const { data: aktualisiert, error: updateFehler } = await supabase
    .from('erfassung_artikel')
    .update({
      status: 'bereit',
      fertig_am: new Date().toISOString(),
      notiz: notiz?.trim() || null,
    })
    .eq('id', params.id)
    .eq('status', 'offen') // niemand hat in der Zwischenzeit schon abgeschickt
    .select('id, nummer, status, notiz, fertig_am')
    .single();

  if (updateFehler || !aktualisiert) {
    return NextResponse.json({ error: updateFehler?.message ?? 'Abschicken fehlgeschlagen.' }, { status: 400 });
  }

  const warnung = await anstossen({
    ereignis: 'artikel.bereit',
    artikelId: aktualisiert.id,
    nummer: aktualisiert.nummer,
    bilder: bilder.length,
  });

  return NextResponse.json({ artikel: aktualisiert, warnung });
}
