/**
 * POST → Die Fotos eines Artikels auswerten.
 *
 * Läuft nach dem Abschicken. Alle Bilder gehen in einen Aufruf, das Ergebnis
 * landet am Artikel, die Schäden in der Notiz, und anschließend wird in
 * PlentyONE nachgesehen, ob es dasselbe Teil schon einmal gab.
 *
 * Der Aufruf ist beliebig oft wiederholbar: Er schreibt immer den ganzen
 * maschinellen Teil neu und hängt nichts an.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminOderFehler, ansichtsLinks } from '@/lib/erfassung/speicher';
import { anthropicKonfiguriert, erkenneArtikel, istLesbar, notizZusammensetzen } from '@/lib/erfassung/erkennung';
import { sucheAehnliche } from '@/lib/erfassung/treffer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel bricht Funktionen sonst nach wenigen Sekunden ab. Die Auswertung
 * mehrerer Fotos braucht länger — 60 Sekunden ist die Obergrenze, die auch im
 * kleinsten Tarif erlaubt ist.
 */
export const maxDuration = 60;

interface BildZeile {
  id: string;
  position: number;
  pfad: string;
  dateiname: string | null;
  hochgeladen: boolean;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  if (!anthropicKonfiguriert()) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY fehlt — ohne ihn kann nichts erkannt werden.' },
      { status: 503 },
    );
  }

  const { data: artikel, error: ladeFehler } = await supabase
    .from('erfassung_artikel')
    .select('id, nummer, status, notiz, bilder:erfassung_bilder (id, position, pfad, dateiname, hochgeladen)')
    .eq('id', params.id)
    .single();
  if (ladeFehler || !artikel) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });

  const bilder = ((artikel.bilder ?? []) as BildZeile[])
    .filter((b) => b.hochgeladen)
    .sort((a, b) => a.position - b.position);
  if (bilder.length === 0) {
    return NextResponse.json({ error: 'Der Artikel hat noch keine hochgeladenen Fotos.' }, { status: 400 });
  }

  const admin = adminOderFehler();
  if ('fehler' in admin) return NextResponse.json({ error: admin.fehler }, { status: 503 });
  const links = await ansichtsLinks(
    admin.admin,
    bilder.map((b) => b.pfad),
  );

  // HEIC vom iPhone kann die Auswertung nicht lesen. Solche Bilder werden
  // übersprungen und benannt — still weglassen wäre der schlechtere Weg, weil
  // dann unerklärlich weniger erkannt würde.
  const auswertbar = bilder.filter((b) => istLesbar(null, b.pfad) && links[b.pfad]);
  const uebersprungen = bilder.length - auswertbar.length;
  const hinweise: string[] = [];
  if (uebersprungen > 0) {
    hinweise.push(
      `${uebersprungen} von ${bilder.length} Fotos konnten nicht gelesen werden (vermutlich HEIC). ` +
        'Am iPhone unter Einstellungen → Kamera → Formate „Maximale Kompatibilität" wählen.',
    );
  }
  if (auswertbar.length === 0) {
    await supabase
      .from('erfassung_artikel')
      .update({ status: 'fehler', erkennung_fehler: hinweise.join(' ') || 'Kein lesbares Foto.' })
      .eq('id', params.id);
    return NextResponse.json({ error: hinweise.join(' ') || 'Kein lesbares Foto.' }, { status: 400 });
  }

  // ---- Auswerten ----------------------------------------------------------
  let ergebnis;
  try {
    ergebnis = await erkenneArtikel(
      auswertbar.map((b, i) => ({ nummer: i + 1, url: links[b.pfad] })),
    );
  } catch (e) {
    const meldung = e instanceof Error ? e.message : String(e);
    await supabase
      .from('erfassung_artikel')
      .update({ status: 'fehler', erkennung_fehler: meldung })
      .eq('id', params.id);
    return NextResponse.json({ error: meldung, hinweise }, { status: 502 });
  }

  const { erkennung } = ergebnis;

  // ---- Schäden in die Notiz ----------------------------------------------
  const notiz = notizZusammensetzen(artikel.notiz, erkennung);

  const { data: aktualisiert, error: schreibFehler } = await supabase
    .from('erfassung_artikel')
    .update({
      erkennung,
      notiz,
      status: 'erkannt',
      erkannt_am: new Date().toISOString(),
      erkennung_fehler: null,
    })
    .eq('id', params.id)
    .select('id, nummer, status, notiz, erkennung, erkannt_am')
    .single();
  if (schreibFehler) {
    return NextResponse.json({ error: schreibFehler.message }, { status: 400 });
  }

  // ---- Rollen an die Fotos schreiben -------------------------------------
  // Wofür ein Foto taugt, entscheidet jetzt die Auswertung, nicht der Mensch
  // am Regal. Fehler hier sind nicht schlimm genug, um den Lauf zu stoppen.
  for (const bewertung of erkennung.bilder ?? []) {
    const bild = auswertbar[bewertung.nummer - 1];
    if (!bild) continue;
    await supabase
      .from('erfassung_bilder')
      .update({ rolle_erkannt: bewertung.rolle, bildbeschreibung: bewertung.beschreibung })
      .eq('id', bild.id);
  }

  // ---- Haben wir das schon mal gehabt? -----------------------------------
  const { treffer, diagnose } = await sucheAehnliche(erkennung);
  await supabase
    .from('erfassung_artikel')
    .update({ treffer: { treffer, diagnose, gesucht_am: new Date().toISOString() } })
    .eq('id', params.id);

  if (!erkennung.typenschildGefunden) {
    hinweise.push('Kein lesbares Typenschild auf den Fotos — ohne Modellnummer wird der Preis später geraten.');
  }

  return NextResponse.json({
    artikel: aktualisiert,
    erkennung,
    treffer,
    diagnose,
    hinweise,
    verbrauch: ergebnis.verbrauch,
  });
}
