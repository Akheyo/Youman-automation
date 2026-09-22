/**
 * POST → Den fertigen Artikel in PlentyONE anlegen.
 *
 * Letzter Schritt des Durchlaufs. Braucht Erkennung, Preis und Listing.
 *
 * Der Artikel wird INAKTIV angelegt. Freigegeben wird im Büro, nach
 * Durchsicht — so ist es festgelegt, und es ist die einzige Stelle, an der
 * eine falsch erkannte Modellnummer noch auffällt, bevor sie auf eBay steht.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Erkennung } from '@/lib/erfassung/erkennung';
import { baueTexte } from '@/lib/plenty/anlegen-kern';
import { getAnlageConfig, legeArtikelAn } from '@/lib/plenty/anlegen';
import { findeKategorie } from '@/lib/plenty/kategorien';
import { plentyEingerichtet } from '@/lib/plenty/client';
import type { Listing } from '@/lib/listing/texte';
import type { Zustand } from '@/lib/preis/regelwerk';
import type { Packklasse } from '@/lib/preis/versand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function istZustand(wert: unknown): wert is Zustand {
  return wert === 'neu_versiegelt' || wert === 'neu' || wert === 'gebraucht' || wert === 'defekt';
}

function istPackklasse(wert: unknown): wert is Packklasse {
  return wert === 'normal' || wert === 'sperrig' || wert === 'schwierig';
}

interface Listingfeld {
  titel1: string;
  titel2: string;
  titel3: string;
  beschreibung: string;
  produktkarte?: string | null;
  teaser?: string | null;
  metaDescription?: string;
  metaKeywords?: string[];
  urlPfad?: string;
  generisch?: boolean;
  darfVeroeffentlichtWerden?: boolean;
  befunde?: Array<{ schwere: string; regel: string; meldung: string }>;
}

interface Preisfeld {
  ebay?: number | null;
  webshop?: number | null;
  versand?: number | null;
  spedition?: boolean;
  herleitung?: string | null;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  if (!(await plentyEingerichtet())) {
    return NextResponse.json({ error: 'PlentyONE ist nicht eingerichtet (siehe Einstellungen).' }, { status: 503 });
  }

  const { data: artikel, error: ladeFehler } = await supabase
    .from('erfassung_artikel')
    .select('id, nummer, erkennung, listing, preis, zustand, bestand, gewicht_kg, packklasse, plenty_item_id')
    .eq('id', params.id)
    .single();
  if (ladeFehler || !artikel) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });

  // Zweimal anlegen wäre zwei Artikel in Plenty, und der zweite fällt
  // niemandem auf, bis er im Shop steht.
  if (artikel.plenty_item_id) {
    return NextResponse.json(
      { error: `Der Artikel liegt bereits in Plenty (ID ${artikel.plenty_item_id}).`, itemId: artikel.plenty_item_id },
      { status: 409 },
    );
  }

  const erkennung = artikel.erkennung as Erkennung | null;
  const listingfeld = artikel.listing as Listingfeld | null;
  const preisfeld = (artikel.preis ?? null) as Preisfeld | null;

  if (!erkennung) return NextResponse.json({ error: 'Der Artikel ist noch nicht ausgewertet.' }, { status: 400 });
  if (!listingfeld) return NextResponse.json({ error: 'Für den Artikel gibt es noch kein Listing.' }, { status: 400 });

  const hinweise: string[] = [];
  if (listingfeld.darfVeroeffentlichtWerden === false) {
    // Angelegt wird er trotzdem — inaktiv, mit dem Befund am Artikel. Im Büro
    // ist ein gesperrter Artikel mit Begründung nützlicher als keiner.
    hinweise.push(
      `Listing ist gesperrt: ${(listingfeld.befunde ?? []).map((b) => b.meldung).join(' ')} ` +
        'Der Artikel wird angelegt, darf aber nicht aktiviert werden.',
    );
  }

  // ---- Kategorie ---------------------------------------------------------
  let kategorieId: number | null = null;
  try {
    const wahl = await findeKategorie({
      artikelTyp: erkennung.artikelTyp,
      hersteller: listingfeld.generisch ? null : erkennung.hersteller,
      weitere: [erkennung.titel, ...(erkennung.suchbegriffe ?? [])],
    });
    kategorieId = wahl.treffer?.id ?? wahl.sammelId;
    hinweise.push(...wahl.begruendung);
    if (!wahl.treffer && wahl.sammelId) hinweise.push('Sammelkategorie verwendet — im Büro zuordnen.');
  } catch (e) {
    hinweise.push(`Kategoriebaum nicht lesbar: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!kategorieId) {
    const meldung =
      'Keine Kategorie gefunden und keine Sammelkategorie hinterlegt (PLENTY_SAMMEL_CATEGORY_ID). ' +
      'Plenty legt ohne Kategorie keine Variante an.';
    await supabase.from('erfassung_artikel').update({ plenty_fehler: meldung }).eq('id', params.id);
    return NextResponse.json({ error: meldung, hinweise }, { status: 400 });
  }

  const zustand: Zustand = istZustand(artikel.zustand) ? artikel.zustand : 'gebraucht';
  const packklasse: Packklasse = istPackklasse(artikel.packklasse) ? artikel.packklasse : 'normal';

  const listing: Listing = {
    titel1: listingfeld.titel1,
    titel2: listingfeld.titel2,
    titel3: listingfeld.titel3,
    beschreibung: listingfeld.beschreibung,
    generisch: listingfeld.generisch === true,
  };

  const texte = baueTexte({
    listing,
    erkennung,
    produktkarte: listingfeld.produktkarte,
    teaser: listingfeld.teaser,
    metaDescription: listingfeld.metaDescription ?? '',
    keywords: listingfeld.metaKeywords ?? [],
    urlPfad: listingfeld.urlPfad ?? '',
  });

  const ergebnis = await legeArtikelAn(
    {
      listing,
      erkennung,
      zustand,
      bestand: Number(artikel.bestand) || 1,
      kategorieId,
      ean: null,
      preisEbay: preisfeld?.ebay ?? null,
      preisWebshop: preisfeld?.webshop ?? null,
      gewichtKg: artikel.gewicht_kg == null ? null : Number(artikel.gewicht_kg),
      packklasse,
      versandkosten: preisfeld?.versand ?? null,
      spedition: preisfeld?.spedition === true,
      texte,
      herleitung: preisfeld?.herleitung ?? null,
    },
    { anlage: getAnlageConfig() },
  );

  const plentyfeld = {
    itemId: ergebnis.itemId,
    variationId: ergebnis.variationId,
    schritte: ergebnis.schritte,
    offen: [...hinweise, ...ergebnis.offen],
    notiz: ergebnis.notiz,
    kategorieId,
    inaktiv: true,
  };

  // Auch ein misslungener Lauf wird gespeichert: Steht die Artikel-ID nicht in
  // der Datenbank, sucht sie später jemand von Hand in Plenty.
  await supabase
    .from('erfassung_artikel')
    .update({
      plenty: plentyfeld,
      plenty_item_id: ergebnis.itemId,
      plenty_variation_id: ergebnis.variationId,
      plenty_am: ergebnis.ok ? new Date().toISOString() : null,
      plenty_fehler: ergebnis.fehler,
      status: ergebnis.ok ? 'in_plenty' : 'fehler',
    })
    .eq('id', params.id);

  if (!ergebnis.ok) {
    return NextResponse.json({ error: ergebnis.fehler, plenty: plentyfeld }, { status: 502 });
  }
  return NextResponse.json({ plenty: plentyfeld, hinweise: plentyfeld.offen });
}
