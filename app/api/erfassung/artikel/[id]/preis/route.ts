/**
 * POST → Preis für einen Artikel recherchieren.
 *
 * Zweiter Schritt des Durchlaufs. Braucht die Erkennung und die Angaben des
 * Menschen (Zustand, Bestand, Gewicht) und liefert Verkaufspreise für eBay
 * und Webshop samt Herleitung.
 *
 * Eigener Aufruf, weil die Websuchen allein schon an die 60-Sekunden-Grenze
 * stoßen. Das Ergebnis landet vollständig am Artikel — auch wenn kein Preis
 * herauskam. Ein Artikel, für den nichts gefunden wurde, ist eine Information;
 * ein Artikel ohne Eintrag sieht aus wie einer, den niemand angefasst hat.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Erkennung } from '@/lib/erfassung/erkennung';
import { istLappArtikel } from '@/lib/listing/markenregeln';
import { anthropicKonfiguriert, recherchiere } from '@/lib/preis/recherche';
import { herleitungText } from '@/lib/preis/recherche-kern';
import { versandkosten, type Packklasse } from '@/lib/preis/versand';
import type { Zustand } from '@/lib/preis/regelwerk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function istZustand(wert: unknown): wert is Zustand {
  return wert === 'neu_versiegelt' || wert === 'neu' || wert === 'gebraucht' || wert === 'defekt';
}

function istPackklasse(wert: unknown): wert is Packklasse {
  return wert === 'normal' || wert === 'sperrig' || wert === 'schwierig';
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  if (!anthropicKonfiguriert()) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY fehlt — ohne ihn gibt es keine Preisrecherche.' }, { status: 503 });
  }

  const { data: artikel, error: ladeFehler } = await supabase
    .from('erfassung_artikel')
    .select('id, nummer, erkennung, zustand, gravierende_schaeden, bestand, gewicht_kg, packklasse')
    .eq('id', params.id)
    .single();
  if (ladeFehler || !artikel) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });

  const erkennung = artikel.erkennung as Erkennung | null;
  if (!erkennung) {
    return NextResponse.json({ error: 'Der Artikel ist noch nicht ausgewertet.' }, { status: 400 });
  }

  const zustand: Zustand = istZustand(artikel.zustand) ? artikel.zustand : 'gebraucht';
  const packklasse: Packklasse = istPackklasse(artikel.packklasse) ? artikel.packklasse : 'normal';
  const gewicht = artikel.gewicht_kg == null ? null : Number(artikel.gewicht_kg);

  // Ohne Gewicht kein Versandsatz — und ohne Versandsatz lässt sich nicht
  // ausrechnen, womit wir bei „Preis plus Versand" der Günstigste sind.
  // Gerechnet wird trotzdem, mit 0: Der Preis ist dann eine Obergrenze, und
  // das steht so in der Herleitung.
  const versand = versandkosten(gewicht, packklasse);

  // Bei LAPP darf der Herstellername nirgends auftauchen — auch nicht in den
  // Suchbegriffen, sonst finden wir einen Preis für ein Listing, das wir gar
  // nicht veröffentlichen dürfen.
  const generisch = istLappArtikel(erkennung.hersteller, [
    erkennung.titel,
    erkennung.artikelTyp,
    erkennung.modell ?? '',
  ]);

  let ergebnis;
  try {
    ergebnis = await recherchiere({
      erkennung,
      zustand,
      gravierendeSchaeden: artikel.gravierende_schaeden === true,
      unserVersand: versand.kosten ?? 0,
      bestand: Number(artikel.bestand) || 1,
      generisch,
    });
  } catch (e) {
    const meldung = e instanceof Error ? e.message : String(e);
    await supabase.from('erfassung_artikel').update({ preis_fehler: meldung }).eq('id', params.id);
    return NextResponse.json({ error: meldung }, { status: 502 });
  }

  const hinweise: string[] = [];
  if (versand.kosten == null && !versand.spedition) {
    hinweise.push(`${versand.begruendung} Der Preis ist ohne Versandabzug gerechnet und damit zu hoch.`);
  }
  if (versand.spedition) hinweise.push(versand.begruendung);
  if (!ergebnis.lohnt.lohntSich) hinweise.push(ergebnis.lohnt.begruendung);
  if (ergebnis.preis.versandFrisstPreis) {
    hinweise.push('Unser Versand ist so hoch, dass wir über Preis plus Versand nicht zu gewinnen sind.');
  }
  if (ergebnis.preis.ebay == null) hinweise.push('Kein Verkaufspreis ableitbar — es fehlen Vergleichsangebote.');

  const herleitung = herleitungText(ergebnis.herleitung);

  const preisfeld = {
    ebay: ergebnis.preis.ebay,
    webshop: ergebnis.preis.webshop,
    versand: versand.kosten,
    spedition: versand.spedition,
    packklasse,
    stufe: ergebnis.quellen.stufe,
    guete: ergebnis.herleitung.guete,
    angebote: ergebnis.angebote,
    ausreisser: ergebnis.preis.ausreisser,
    lohnt: ergebnis.lohnt,
    bemerkungen: ergebnis.bemerkungen,
    herleitung,
    hinweise,
  };

  const { error: schreibFehler } = await supabase
    .from('erfassung_artikel')
    .update({ preis: preisfeld, preis_am: new Date().toISOString(), preis_fehler: null })
    .eq('id', params.id);
  if (schreibFehler) return NextResponse.json({ error: schreibFehler.message }, { status: 400 });

  return NextResponse.json({ preis: preisfeld, hinweise });
}
