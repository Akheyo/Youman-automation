/**
 * Artikelbilder nach Plenty übertragen.
 *
 * Ohne Bilder ist der Artikel in Plenty kein Artikel, sondern ein Datensatz:
 * Gebrauchtware verkauft sich über Fotos, und bei uns zeigen die Fotos genau
 * das Stück, das der Käufer bekommt. Deshalb gehören sie zur Anlage.
 *
 * Getrennt von `anlegen.ts`, weil sie das Gegenteil brauchen: Die Anlage ist
 * ein Dutzend kleiner JSON-Aufrufe, hier gehen Megabytes über die Leitung.
 * Ein Bild, das nicht durchgeht, darf die anderen nicht mitnehmen — am Ende
 * steht, welche oben sind und welche fehlen.
 */

import { aktuelleConfig, plentyJson, plentyToken, type PlentyConfig } from './client';

/** Ein zu übertragendes Bild. */
export interface Quellbild {
  /** Woher es zu holen ist — bei uns ein signierter Supabase-Link. */
  url: string;
  /** Der Dateiname, unter dem es in Plenty liegen soll (SEO-Dateiname). */
  dateiname: string;
  /** Alt-Text; steht später im `alt`-Attribut und im ImageObject. */
  altText: string;
  /** Position in der Anzeige. 0 ist das Titelbild. */
  position: number;
}

export interface Bildergebnis {
  /** Wie viele Bilder in Plenty liegen. */
  uebertragen: number;
  /** Plentys IDs, in derselben Reihenfolge wie die Quellen. */
  imageIds: number[];
  /** Je Bild, das nicht durchging: Dateiname und Grund. */
  fehler: Array<{ dateiname: string; grund: string }>;
}

/**
 * Obergrenze je Bild.
 *
 * Handyfotos in voller Auflösung sind 4 bis 12 MB. Darüber ist etwas faul —
 * und ein 60-MB-Upload in einer Funktion mit 60 Sekunden Laufzeit bricht
 * ohnehin ab, nur eben ohne verwertbare Meldung.
 */
export const MAX_BILD_BYTES = 20 * 1024 * 1024;

/** Wie viele Bilder je Artikel höchstens übertragen werden. */
export const MAX_BILDER = 12;

function endung(dateiname: string): string {
  const treffer = /\.([a-z0-9]+)$/i.exec(dateiname);
  return (treffer?.[1] ?? 'jpg').toLowerCase();
}

function medientyp(dateiname: string): string {
  const e = endung(dateiname);
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * Holt ein Bild und gibt es als Base64 zurück.
 *
 * Plentys Bild-Endpunkt nimmt die Datei als Base64 im JSON-Rumpf entgegen.
 * Das bläht die Anfrage um ein Drittel auf — dafür braucht es kein
 * multipart-Gebastel, und der Rumpf geht denselben Weg wie alle anderen
 * Aufrufe.
 */
export async function ladeBild(url: string): Promise<{ base64: string; bytes: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bild nicht abrufbar (HTTP ${res.status}).`);
  const puffer = Buffer.from(await res.arrayBuffer());
  if (puffer.byteLength === 0) throw new Error('Bild ist leer.');
  if (puffer.byteLength > MAX_BILD_BYTES) {
    throw new Error(`Bild ist ${(puffer.byteLength / 1024 / 1024).toFixed(1)} MB groß — mehr als erlaubt.`);
  }
  return { base64: puffer.toString('base64'), bytes: puffer.byteLength };
}

interface PlentyBildAntwort {
  id?: number;
}

/**
 * Überträgt die Bilder eines Artikels.
 *
 * Wirft nie. Ein Artikel mit vier von fünf Bildern ist brauchbar; einer, der
 * an Bild fünf gescheitert ist und deshalb gar keine hat, ist es nicht.
 */
export async function uebertrageBilder(
  itemId: number,
  variationId: number,
  bilder: Quellbild[],
  cfg?: PlentyConfig,
): Promise<Bildergebnis> {
  const zugang = cfg ?? (await aktuelleConfig());
  const ergebnis: Bildergebnis = { uebertragen: 0, imageIds: [], fehler: [] };

  // Der Token wird einmal geholt; sonst meldet sich jedes Bild neu an.
  await plentyToken(zugang);

  for (const bild of bilder.slice(0, MAX_BILDER)) {
    try {
      const { base64 } = await ladeBild(bild.url);

      const angelegt = await plentyJson<PlentyBildAntwort>(
        'POST',
        `/rest/items/${itemId}/images/upload`,
        {
          uploadImageData: base64,
          uploadFileName: bild.dateiname,
          type: medientyp(bild.dateiname),
          position: bild.position,
        },
        zugang,
      );

      const imageId = angelegt?.id;
      if (!imageId) throw new Error('Plenty lieferte keine Bild-ID zurück.');
      ergebnis.imageIds.push(imageId);
      ergebnis.uebertragen += 1;

      // Der Alt-Text ist kein Beiwerk: Er steht später im `alt`-Attribut und
      // im strukturierten Datenblock. Schlägt er fehl, bleibt das Bild
      // trotzdem oben — ein Bild ohne Alt-Text ist besser als keins.
      try {
        await plentyJson(
          'POST',
          `/rest/items/${itemId}/images/${imageId}/names`,
          { lang: 'de', name: bild.altText, alternate: bild.altText },
          zugang,
        );
      } catch (err) {
        ergebnis.fehler.push({ dateiname: bild.dateiname, grund: `Alt-Text: ${(err as Error).message}` });
      }

      // Ohne Zuordnung zur Variante zeigt Plenty das Bild am Artikel, aber
      // nicht an der Variante — und verkauft wird die Variante.
      try {
        await plentyJson(
          'POST',
          `/rest/items/${itemId}/images/${imageId}/variation_images`,
          { imageId, variationId },
          zugang,
        );
      } catch (err) {
        ergebnis.fehler.push({
          dateiname: bild.dateiname,
          grund: `Zuordnung zur Variante: ${(err as Error).message}`,
        });
      }
    } catch (err) {
      ergebnis.fehler.push({ dateiname: bild.dateiname, grund: (err as Error).message });
    }
  }

  if (bilder.length > MAX_BILDER) {
    ergebnis.fehler.push({
      dateiname: `${bilder.length - MAX_BILDER} weitere`,
      grund: `Nur die ersten ${MAX_BILDER} Bilder wurden übertragen.`,
    });
  }

  return ergebnis;
}
