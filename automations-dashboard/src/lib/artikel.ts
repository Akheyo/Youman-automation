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
 */

export const ARTIKEL_ANSICHT = 'v_artikel_komplett';

export interface Spaltenzuordnung {
  alle: string[];
  artikelnummer: string | null;
  ean: string | null;
  titel: string | null;
  beschreibung: string | null;
  bilder: string | null;
  bestand: string[];
  preise: string[];
  lager: string | null;
  gewicht: string | null;
  /** Spalten, in denen sinnvoll gesucht werden kann. */
  suchbar: string[];
}

const muster = {
  artikelnummer: /(artikel(nummer|_nr)|variation(s)?(nummer|_number)|^number$|sku)/i,
  ean: /(ean|gtin|barcode)/i,
  titel: /^(titel|title|name|artikelname|bezeichnung)$/i,
  beschreibung: /(beschreibung|description|text)/i,
  bilder: /(bilder|images|bild)/i,
  bestand: /(bestand|stock|netto|physisch|reserviert|verfuegbar|verfügbar)/i,
  preis: /(preis|price|vk|uvp|netto_preis)/i,
  lager: /(lager|warehouse)/i,
  gewicht: /(gewicht|weight)/i,
};

function ersteTreffer(spalten: string[], regel: RegExp): string | null {
  return spalten.find((name) => regel.test(name)) ?? null;
}

/** Einmal nachsehen, wie die Ansicht aufgebaut ist. */
export async function spaltenErkennen(): Promise<Spaltenzuordnung> {
  const { data, error } = await supabase.from(ARTIKEL_ANSICHT).select('*').limit(1);
  if (error) throw new Error(fehlerText(error, 'Die Artikeldaten') ?? error.message);

  const zeile = (data?.[0] ?? {}) as Zeile;
  const alle = Object.keys(zeile);

  const titel =
    alle.find((name) => muster.titel.test(name)) ??
    alle.find((name) => /titel|title|name/i.test(name) && !/meta/i.test(name)) ??
    null;

  const beschreibung =
    alle.find((name) => muster.beschreibung.test(name) && !/meta/i.test(name)) ?? null;

  const zuordnung: Spaltenzuordnung = {
    alle,
    artikelnummer: ersteTreffer(alle, muster.artikelnummer),
    ean: ersteTreffer(alle, muster.ean),
    titel,
    beschreibung,
    bilder: ersteTreffer(alle, muster.bilder),
    bestand: alle.filter((name) => muster.bestand.test(name)),
    preise: alle.filter((name) => muster.preis.test(name)),
    lager: ersteTreffer(alle, muster.lager),
    gewicht: ersteTreffer(alle, muster.gewicht),
    suchbar: [],
  };

  /* Gesucht wird nur in Spalten, die Text enthalten. */
  const textspalten = [zuordnung.artikelnummer, zuordnung.ean, zuordnung.titel].filter(
    (name): name is string => Boolean(name),
  );
  zuordnung.suchbar = textspalten.length > 0 ? textspalten : titel ? [titel] : [];

  return zuordnung;
}

/** Zeichen entfernen, die PostgREST in einem oder-Filter falsch versteht. */
function suchbegriffSaeubern(begriff: string): string {
  return begriff.replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);
}

export interface Suchergebnis {
  zeilen: Zeile[];
  /** Spalten, in denen tatsächlich gesucht wurde. */
  gesuchtIn: string[];
  /** true, wenn wegen eines Fehlers nur noch im Titel gesucht wurde. */
  eingeschraenkt: boolean;
}

export async function artikelSuchen(
  begriff: string,
  zuordnung: Spaltenzuordnung,
  grenze = 40,
): Promise<Suchergebnis> {
  const sauber = suchbegriffSaeubern(begriff);
  if (!sauber) return { zeilen: [], gesuchtIn: [], eingeschraenkt: false };

  const versuchen = async (spalten: string[]) => {
    const bedingung = spalten.map((name) => `${name}.ilike.%${sauber}%`).join(',');
    const { data, error } = await supabase
      .from(ARTIKEL_ANSICHT)
      .select('*')
      .or(bedingung)
      .limit(grenze);
    if (error) throw error;
    return (data ?? []) as Zeile[];
  };

  try {
    const zeilen = await versuchen(zuordnung.suchbar);
    return { zeilen, gesuchtIn: zuordnung.suchbar, eingeschraenkt: false };
  } catch (fehler) {
    /*
     * Nicht jede Spalte ist Text. Trifft die Suche auf eine Zahl, lehnt die
     * Datenbank ab. Dann bleibt der Titel, das ist besser als gar nichts.
     */
    if (zuordnung.titel) {
      try {
        const zeilen = await versuchen([zuordnung.titel]);
        return { zeilen, gesuchtIn: [zuordnung.titel], eingeschraenkt: true };
      } catch {
        /* fällt unten durch */
      }
    }
    const meldung =
      fehler && typeof fehler === 'object' && 'message' in fehler
        ? String((fehler as { message: unknown }).message)
        : 'Die Suche ist fehlgeschlagen.';
    throw new Error(meldung);
  }
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
