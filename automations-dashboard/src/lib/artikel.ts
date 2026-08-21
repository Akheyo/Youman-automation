import { supabase } from './supabase';
import { fehlerText } from './queries';
import type { Zeile } from './fields';

/**
 * Suche in den Artikeldaten aus PlentyONE.
 *
 * Die View v_artikel_komplett führt Varianten und Texte zusammen. Welche
 * Spalten sie genau hat, steht nicht fest, deshalb schaut die Suche einmal
 * selbst nach: Sie holt eine Zeile, sieht sich die Spaltennamen an und ordnet
 * sie zu. Was sie nicht erkennt, zeigt sie trotzdem an, nur eben unsortiert.
 *
 * Für die Geschwindigkeit gilt zweierlei. Erstens holt die Liste nur die
 * Spalten, die sie wirklich zeigt, nicht Beschreibung und Meta-Texte. Die
 * vollständige Zeile kommt erst beim Aufklappen. Zweitens sucht jedes Feld
 * gezielt in seiner eigenen Spalte, statt einen Begriff über alle zu jagen.
 */

export const ARTIKEL_ANSICHT = 'v_artikel_komplett';

export interface Spaltenzuordnung {
  alle: string[];
  schluessel: string | null;
  artikelId: string | null;
  artikelnummer: string | null;
  ean: string | null;
  titel: string | null;
  hersteller: string | null;
  beschreibung: string | null;
  bilder: string | null;
  bestand: string[];
  preise: string[];
  lager: string | null;
  gewicht: string | null;
  /** Spalten, die die Trefferliste tatsächlich braucht. */
  listenspalten: string[];
}

const muster = {
  schluessel: /^(id|variation_id|variations_id|variationsnummer|variation)$/i,
  artikelId: /^(artikel_?id|item_?id|plenty_?artikel_?id|plenty_?item_?id)$/i,
  artikelnummer: /(artikel(nummer|_nr)|variation(s)?(nummer|_number)|^number$|sku)/i,
  ean: /(ean|gtin|barcode)/i,
  titel: /^(titel|title|name|artikelname|bezeichnung)$/i,
  hersteller: /(hersteller|manufacturer|marke|brand)/i,
  beschreibung: /(beschreibung|description|text)/i,
  bilder: /(bilder|images|bild)/i,
  bestand: /(bestand|stock|netto|physisch|reserviert|verfuegbar|verfügbar)/i,
  preis: /(preis|price|vk|uvp)/i,
  lager: /(lager|warehouse)/i,
  gewicht: /(gewicht|weight)/i,
};

function ersterTreffer(spalten: string[], regel: RegExp): string | null {
  return spalten.find((name) => regel.test(name)) ?? null;
}

export async function spaltenErkennen(): Promise<Spaltenzuordnung> {
  const { data, error } = await supabase.from(ARTIKEL_ANSICHT).select('*').limit(1);
  if (error) throw new Error(fehlerText(error, 'Die Artikeldaten') ?? error.message);

  const zeile = (data?.[0] ?? {}) as Zeile;
  const alle = Object.keys(zeile);

  const titel =
    alle.find((name) => muster.titel.test(name)) ??
    alle.find((name) => /titel|title|name/i.test(name) && !/meta|hersteller|marke|brand/i.test(name)) ??
    null;

  const zuordnung: Spaltenzuordnung = {
    alle,
    schluessel: ersterTreffer(alle, muster.schluessel),
    artikelId: ersterTreffer(alle, muster.artikelId),
    artikelnummer: ersterTreffer(alle, muster.artikelnummer),
    ean: ersterTreffer(alle, muster.ean),
    titel,
    hersteller: ersterTreffer(alle, muster.hersteller),
    beschreibung: alle.find((name) => muster.beschreibung.test(name) && !/meta/i.test(name)) ?? null,
    bilder: ersterTreffer(alle, muster.bilder),
    bestand: alle.filter((name) => muster.bestand.test(name)),
    preise: alle.filter((name) => muster.preis.test(name)),
    lager: ersterTreffer(alle, muster.lager),
    gewicht: ersterTreffer(alle, muster.gewicht),
    listenspalten: [],
  };

  /* Nur das, was in der Liste steht. Alles andere wäre unnötige Last. */
  const gewuenscht = [
    zuordnung.schluessel,
    zuordnung.artikelId,
    zuordnung.artikelnummer,
    zuordnung.ean,
    zuordnung.titel,
    zuordnung.hersteller,
    zuordnung.bilder,
    zuordnung.bestand[0] ?? null,
    zuordnung.preise[0] ?? null,
  ].filter((name): name is string => Boolean(name));

  zuordnung.listenspalten = [...new Set(gewuenscht)];
  return zuordnung;
}

/** Zeichen entfernen, die PostgREST in Filtern falsch versteht. */
function saeubern(begriff: string): string {
  return begriff.replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);
}

export interface Suchfelder {
  artikelId: string;
  artikelnummer: string;
  ean: string;
  titel: string;
  hersteller: string;
}

export const LEERE_SUCHE: Suchfelder = {
  artikelId: '',
  artikelnummer: '',
  ean: '',
  titel: '',
  hersteller: '',
};

export function sucheIstLeer(felder: Suchfelder): boolean {
  /* Die Artikel-ID trifft genau, deshalb reicht dort schon ein Zeichen. */
  if (felder.artikelId.trim().length >= 1) return false;
  return Object.values(felder).every((wert) => wert.trim().length < 2);
}

export interface Suchergebnis {
  zeilen: Zeile[];
  /** Wie lange die Datenbank gebraucht hat, in Millisekunden. */
  dauer: number;
}

/**
 * Jedes ausgefüllte Feld schränkt weiter ein, alle gelten zusammen.
 * Artikelnummer, EAN und Hersteller suchen von vorne, das ist genau und
 * schnell. Der Titel sucht überall im Text, weil man dort selten den Anfang
 * kennt.
 */
export async function artikelSuchen(
  felder: Suchfelder,
  zuordnung: Spaltenzuordnung,
  grenze = 40,
): Promise<Suchergebnis> {
  const beginn = performance.now();

  let abfrage = supabase.from(ARTIKEL_ANSICHT).select(zuordnung.listenspalten.join(',')).limit(grenze);

  const anlegen = (spalte: string | null, wert: string, vonVorne: boolean) => {
    const sauber = saeubern(wert);
    if (!spalte || sauber.length < 2) return;
    abfrage = abfrage.ilike(spalte, vonVorne ? `${sauber}%` : `%${sauber}%`);
  };

  /*
   * Die Artikel-ID aus PlentyONE ist eine Zahl und meint genau einen Artikel.
   * Deshalb wird sie exakt verglichen, nicht als Text durchsucht. Das ist
   * schneller und liefert keine Zufallstreffer aus Titeln.
   */
  const idWert = saeubern(felder.artikelId);
  if (zuordnung.artikelId && idWert) {
    abfrage = abfrage.eq(zuordnung.artikelId, idWert);
  }

  anlegen(zuordnung.artikelnummer, felder.artikelnummer, true);
  anlegen(zuordnung.ean, felder.ean, true);
  anlegen(zuordnung.titel, felder.titel, false);
  anlegen(zuordnung.hersteller, felder.hersteller, true);

  const { data, error } = await abfrage;
  if (error) throw new Error(fehlerText(error, 'Die Artikelsuche') ?? error.message);

  return { zeilen: (data ?? []) as unknown as Zeile[], dauer: Math.round(performance.now() - beginn) };
}

/** Die vollständige Zeile, erst wenn jemand sie wirklich sehen will. */
export async function artikelDetailLaden(zuordnung: Spaltenzuordnung, zeile: Zeile): Promise<Zeile> {
  if (!zuordnung.schluessel) return zeile;
  const wert = zeile[zuordnung.schluessel];
  if (wert === null || wert === undefined) return zeile;

  const { data, error } = await supabase
    .from(ARTIKEL_ANSICHT)
    .select('*')
    .eq(zuordnung.schluessel, wert as string)
    .limit(1);
  if (error) throw new Error(fehlerText(error, 'Der Artikel') ?? error.message);
  return ((data?.[0] as Zeile | undefined) ?? zeile);
}

export interface Bild {
  gross: string | null;
  mittel: string | null;
  vorschau: string | null;
  position: number;
}

/**
 * Die Spalte Bilder ist ein Array von Objekten mit drei Größen und einer
 * Reihenfolge, kein Array von Adressen. Ältere Bestände können auch noch
 * einfache Adressen enthalten, deshalb wird beides angenommen.
 */
export function bilderLesen(wert: unknown): Bild[] {
  let roh: unknown = wert;
  if (typeof roh === 'string') {
    const text = roh;
    try {
      roh = JSON.parse(text);
    } catch {
      return [{ gross: text, mittel: text, vorschau: text, position: 0 }];
    }
  }
  if (!Array.isArray(roh)) return [];

  return roh
    .map((eintrag, index): Bild => {
      if (typeof eintrag === 'string') {
        return { gross: eintrag, mittel: eintrag, vorschau: eintrag, position: index };
      }
      const objekt = (eintrag ?? {}) as Record<string, unknown>;
      const text = (name: string) => {
        const inhalt = objekt[name];
        return typeof inhalt === 'string' && inhalt.trim() ? inhalt : null;
      };
      const gross = text('gross') ?? text('large') ?? text('url');
      const mittel = text('mittel') ?? text('middle') ?? gross;
      const vorschau = text('vorschau') ?? text('preview') ?? text('thumb') ?? mittel;
      const position = Number(objekt.position ?? index);
      return { gross, mittel, vorschau, position: Number.isFinite(position) ? position : index };
    })
    .filter((bild) => bild.gross || bild.mittel || bild.vorschau)
    .sort((a, b) => a.position - b.position);
}
