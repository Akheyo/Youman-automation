/**
 * POST → Das Listing für einen Artikel texten.
 *
 * Dritter Schritt des Durchlaufs. Braucht die Erkennung; der Preis wird nur
 * fürs Markup verwendet und ist nicht Bedingung.
 *
 * Der Fließtext (Teaser, Anwendung, Vorteile, FAQ) kostet einen eigenen
 * Claude-Aufruf und ist der Grund für den eigenen Schritt. Schlägt er fehl,
 * wird das Listing trotzdem gebaut — dann eben ohne die Fließtextteile. Eine
 * Produktkarte mit Zustand, Merkmalen und Lieferumfang ist unvollständig,
 * aber brauchbar; gar keine ist es nicht.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Erkennung } from '@/lib/erfassung/erkennung';
import { adminOderFehler, ansichtsLinks } from '@/lib/erfassung/speicher';
import { anthropicKonfiguriert, schreibeFliesstext } from '@/lib/listing/fliesstext';
import { istLappArtikel } from '@/lib/listing/markenregeln';
import { baueListingpaket } from '@/lib/listing/zusammenbau';
import type { Fliesstext } from '@/lib/listing/texte';
import type { Zustand } from '@/lib/preis/regelwerk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function istZustand(wert: unknown): wert is Zustand {
  return wert === 'neu_versiegelt' || wert === 'neu' || wert === 'gebraucht' || wert === 'defekt';
}

interface BildZeile {
  position: number;
  pfad: string;
  rolle_erkannt: string | null;
  hochgeladen: boolean;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: artikel, error: ladeFehler } = await supabase
    .from('erfassung_artikel')
    .select(
      'id, nummer, erkennung, notiz, zustand, gravierende_schaeden, bestand, erfasst_von, preis, bilder:erfassung_bilder (position, pfad, rolle_erkannt, hochgeladen)',
    )
    .eq('id', params.id)
    .single();
  if (ladeFehler || !artikel) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });

  const erkennung = artikel.erkennung as Erkennung | null;
  if (!erkennung) return NextResponse.json({ error: 'Der Artikel ist noch nicht ausgewertet.' }, { status: 400 });

  const zustand: Zustand = istZustand(artikel.zustand) ? artikel.zustand : 'gebraucht';
  const generisch = istLappArtikel(erkennung.hersteller, [
    erkennung.titel,
    erkennung.artikelTyp,
    erkennung.modell ?? '',
  ]);

  // ---- Fließtext ---------------------------------------------------------
  const hinweise: string[] = [];
  let fliesstext: Fliesstext | null = null;
  if (anthropicKonfiguriert()) {
    try {
      const geschrieben = await schreibeFliesstext({
        erkennung,
        zustand,
        notiz: artikel.notiz,
        generisch,
      });
      fliesstext = geschrieben.text;
      if (geschrieben.befund.erfundeneAngaben.length > 0) {
        // Nicht verschweigen: Wenn das Modell Zahlen erfindet, ist das ein
        // Hinweis darauf, dass die Datengrundlage zu dünn war.
        hinweise.push(
          `Aus dem Text entfernt, weil die Angaben nirgends belegt sind: ${geschrieben.befund.erfundeneAngaben.join(', ')}.`,
        );
      }
    } catch (e) {
      hinweise.push(`Fließtext konnte nicht geschrieben werden: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    hinweise.push('ANTHROPIC_API_KEY fehlt — die Produktkarte bleibt ohne Fließtext.');
  }

  // ---- Bildadressen fürs Markup ------------------------------------------
  // Die signierten Links laufen ab und taugen nicht fürs JSON-LD. Es gibt sie
  // hier nur, damit Alt-Texte und Dateinamen entstehen; die endgültigen
  // Adressen vergibt Plenty beim Hochladen der Bilder.
  const bilder = ((artikel.bilder ?? []) as BildZeile[])
    .filter((b) => b.hochgeladen)
    .sort((a, b) => a.position - b.position);

  let bildUrls: string[] = [];
  const admin = adminOderFehler();
  if (!('fehler' in admin) && bilder.length > 0) {
    const links = await ansichtsLinks(
      admin.admin,
      bilder.map((b) => b.pfad),
    );
    bildUrls = bilder.map((b) => links[b.pfad]).filter(Boolean);
  }

  const preis = (artikel.preis ?? null) as { webshop?: number | null } | null;
  const shopBasis = process.env.SHOP_BASIS_URL?.trim() || null;

  const paket = baueListingpaket({
    erkennung,
    zustand,
    notiz: artikel.notiz,
    bearbeiter: artikel.erfasst_von,
    bestand: Number(artikel.bestand) || 1,
    preis: preis?.webshop ?? null,
    fliesstext,
    shopBasis,
    bildUrls,
    bildRollen: bilder.map((b) => b.rolle_erkannt),
  });

  if (!shopBasis) {
    hinweise.push('SHOP_BASIS_URL fehlt — ohne sie entstehen keine strukturierten Daten (JSON-LD).');
  }
  for (const befund of paket.befunde) {
    hinweise.push(`${befund.schwere === 'sperre' ? 'Sperre' : 'Hinweis'} (${befund.regel}): ${befund.meldung}`);
  }

  const listingfeld = {
    titel1: paket.listing.titel1,
    titel2: paket.listing.titel2,
    titel3: paket.listing.titel3,
    beschreibung: paket.listing.beschreibung,
    produktkarte: paket.produktkarte,
    seoTitle: paket.seoTitle,
    metaDescription: paket.metaDescription,
    metaKeywords: paket.metaKeywords,
    urlPfad: paket.urlPfad,
    suchbegriffe: paket.suchbegriffe,
    teaser: fliesstext?.teaser ?? null,
    fliesstext,
    bilder: paket.bilder,
    markup: paket.markup,
    generisch: paket.listing.generisch,
    befunde: paket.befunde,
    darfVeroeffentlichtWerden: paket.darfVeroeffentlichtWerden,
    hinweise,
  };

  const { error: schreibFehler } = await supabase
    .from('erfassung_artikel')
    .update({ listing: listingfeld, listing_am: new Date().toISOString(), listing_fehler: null })
    .eq('id', params.id);
  if (schreibFehler) return NextResponse.json({ error: schreibFehler.message }, { status: 400 });

  return NextResponse.json({ listing: listingfeld, hinweise });
}
