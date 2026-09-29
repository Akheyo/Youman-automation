/**
 * Was ein Artikel in PlentyONE hergibt — gelesen, nicht geraten.
 *
 * Die Zerlegung der Antworten steht als reine Funktion (`leseVariante`,
 * `bildUrls`, `leseTexte`) getrennt vom Abruf. Das ist hier kein Selbstzweck:
 * PlentyONE-Instanzen liefern dieselben Daten je nach Ausbaustufe an
 * unterschiedlichen Stellen — mal als Liste, mal unter `entries`, Preise mal
 * als `salesPrices`, mal als `variationSalesPrices`. Genau diese Fälle lassen
 * sich nur dann festhalten, wenn man sie ohne laufendes Plenty durchspielen
 * kann.
 *
 * WELCHER PREIS: Marktplaats bekommt den Webshop-Preis, ersatzweise den
 * eBay-Preis. Nicht umgekehrt — der eBay-Preis enthält die Gebühren des
 * Marktplatzes, und sie auf einem anderen Kanal mitzunehmen, macht das
 * Angebot ohne Not teurer.
 */

import { plentyGet } from '@/lib/plenty/client';
import { getAnlageConfig } from '@/lib/plenty/anlegen';
import type { Zustand } from '@/lib/preis/regelwerk';

export interface Quellartikel {
  variationId: number;
  itemId: number | null;
  /** Variantennummer, z. B. „KK-2024-0815-H6R5A7". */
  nummer: string | null;
  titel: string;
  beschreibung: string;
  hersteller: string | null;
  mpn: string | null;
  ean: string | null;
  preisEuro: number | null;
  bestand: number;
  bildUrls: string[];
  /** Name der Plenty-Kategorie, soweit ermittelbar — Grundlage der Zuordnung. */
  kategorie: string | null;
  zustand: Zustand;
}

type Liste<T> = { entries?: T[] } | T[] | null | undefined;

/** Plenty antwortet je nach Endpunkt als Liste oder als `{entries: []}`. */
export function eintraege<T>(res: Liste<T>): T[] {
  if (Array.isArray(res)) return res;
  return res?.entries ?? [];
}

function zahl(wert: unknown): number | null {
  const n = Number(wert);
  return Number.isFinite(n) ? n : null;
}

function text(wert: unknown): string | null {
  return typeof wert === 'string' && wert.trim() ? wert.trim() : null;
}

interface RohVariante {
  id?: number;
  itemId?: number;
  number?: string;
  name?: string;
  stockLimitation?: number;
  salesPrices?: Array<{ salesPriceId?: number; price?: number }>;
  variationSalesPrices?: Array<{ salesPriceId?: number; price?: number }>;
  variationBarcodes?: Array<{ code?: string; barcodeId?: number }>;
  barcodes?: Array<{ code?: string }>;
  model?: string;
  externalId?: string;
  item?: {
    id?: number;
    manufacturerId?: number;
    texts?: Array<{ name1?: string; name2?: string; description?: string; shortDescription?: string }>;
  };
}

/**
 * Sucht einen Preis aus den Preiszeilen.
 *
 * Erst die gewünschte Preisliste, dann die Ersatzliste, und erst wenn beide
 * fehlen, irgendeinen Preis über null. Die letzte Stufe ist bewusst dabei und
 * bewusst die letzte: Ein Artikel mit genau einer Preiszeile ohne passende ID
 * soll nicht ewig als „ohne Preis" liegenbleiben — aber eine Preisliste, die
 * es gibt, hat immer Vorrang.
 */
export function findePreis(
  zeilen: Array<{ salesPriceId?: number; price?: number }>,
  reihenfolge: Array<number | null>,
): number | null {
  for (const id of reihenfolge) {
    if (!id) continue;
    const treffer = zeilen.find((z) => Number(z?.salesPriceId) === id && Number(z?.price) > 0);
    if (treffer) return Number(treffer.price);
  }
  const irgendeiner = zeilen.find((z) => Number(z?.price) > 0);
  return irgendeiner ? Number(irgendeiner.price) : null;
}

/** Zieht die Bildadressen aus der Bildliste, in Anzeigereihenfolge. */
export function bildUrls(res: Liste<Record<string, unknown>>): string[] {
  const bilder = eintraege(res);
  return [...bilder]
    .sort((a, b) => (zahl(a?.position) ?? 99) - (zahl(b?.position) ?? 99))
    .map((b) => {
      // Marktplaats lädt die Datei selbst herunter und skaliert auf 1024er
      // Kante. Deshalb die größte verfügbare Fassung — die Vorschaubilder
      // sähen in der Anzeige aus wie ein Schnappschuss.
      const kandidaten = [b?.url, b?.urlMiddle, b?.urlSecondPreview, b?.urlPreview];
      return kandidaten.find((k): k is string => typeof k === 'string' && /^https?:\/\//i.test(k)) ?? null;
    })
    .filter((u): u is string => Boolean(u))
    // GIF nimmt Marktplaats nicht an; es hier wegzulassen ist besser, als die
    // ganze Bildübergabe an einem Bild scheitern zu lassen.
    .filter((u) => !/\.gif($|\?)/i.test(u));
}

/** Setzt aus den Textzeilen einer Variante Titel und Beschreibung zusammen. */
export function leseTexte(res: Liste<Record<string, unknown>>): { titel: string | null; beschreibung: string | null } {
  const zeilen = eintraege(res);
  const erstes = (felder: string[]): string | null => {
    for (const zeile of zeilen) {
      for (const feld of felder) {
        const wert = text(zeile?.[feld]);
        if (wert) return wert;
      }
    }
    return null;
  };
  return {
    titel: erstes(['name1', 'name', 'name2', 'name3']),
    // Die Langbeschreibung zuerst; die Kurzbeschreibung ist oft nur ein
    // Schlagwort und ergäbe eine Anzeige aus drei Wörtern.
    beschreibung: erstes(['description', 'shortDescription', 'technicalData']),
  };
}

/** Macht aus einer Plenty-Variante das, was die Anzeige braucht. */
export function leseVariante(
  roh: RohVariante,
  opts: { preisReihenfolge: Array<number | null> },
): Pick<Quellartikel, 'variationId' | 'itemId' | 'nummer' | 'titel' | 'mpn' | 'ean' | 'preisEuro'> {
  const preiszeilen = roh.variationSalesPrices ?? roh.salesPrices ?? [];
  const barcodes = roh.variationBarcodes ?? roh.barcodes ?? [];
  const ean = barcodes.map((b) => text(b?.code)).find((c): c is string => Boolean(c)) ?? null;
  const itemTexte = roh.item?.texts?.[0];

  return {
    variationId: zahl(roh.id) ?? 0,
    itemId: zahl(roh.itemId) ?? zahl(roh.item?.id),
    nummer: text(roh.number),
    titel: text(roh.name) ?? text(itemTexte?.name1) ?? '',
    mpn: text(roh.model) ?? null,
    ean,
    preisEuro: findePreis(preiszeilen, opts.preisReihenfolge),
  };
}

// ---------------------------------------------------------------------------
// Abruf
// ---------------------------------------------------------------------------

/** In welcher Reihenfolge Preislisten gelten: Webshop vor eBay. */
export function preisReihenfolge(): Array<number | null> {
  const cfg = getAnlageConfig();
  return [cfg.salesPriceWebshopId, cfg.salesPriceEbayId];
}

/**
 * Lädt einen Artikel so weit, wie die Anzeige ihn braucht.
 *
 * Drei Aufrufe je Artikel: Variante, Texte, Bilder. Das ist der Preis dafür,
 * dass die Variantenliste je nach Plenty-Version keine Beschreibung mitliefert
 * — derselbe Befund wie beim Lagerplatz-Scan. Deshalb läuft der Abgleich in
 * Häppchen und nicht in einem Zug.
 */
export async function ladeArtikel(
  variationId: number,
  vorab: { itemId?: number | null; bestand?: number } = {},
): Promise<Quellartikel | null> {
  const liste = await plentyGet<Liste<RohVariante>>(
    `/rest/items/variations?id=${variationId}&itemsPerPage=1&with=variationSalesPrices,variationBarcodes,item`,
  );
  const roh = eintraege(liste)[0];
  if (!roh) return null;

  const kern = leseVariante(roh, { preisReihenfolge: preisReihenfolge() });
  const itemId = kern.itemId ?? vorab.itemId ?? null;

  let titel = kern.titel;
  let beschreibung = '';
  if (itemId) {
    try {
      const texte = await plentyGet<Liste<Record<string, unknown>>>(
        `/rest/items/${itemId}/variations/${variationId}/descriptions`,
      );
      const gelesen = leseTexte(texte);
      titel = gelesen.titel ?? titel;
      beschreibung = gelesen.beschreibung ?? '';
    } catch {
      // Ohne Texte bleibt der Variantenname. Das ist mager, aber kein Grund,
      // den ganzen Artikel liegenzulassen — die Anzeige wird dann mangels
      // Beschreibung ohnehin zurückgehalten und gezählt.
    }
  }

  let bilder: string[] = [];
  if (itemId) {
    try {
      bilder = bildUrls(await plentyGet<Liste<Record<string, unknown>>>(`/rest/items/${itemId}/images`));
      if (!bilder.length) {
        bilder = bildUrls(
          await plentyGet<Liste<Record<string, unknown>>>(`/rest/items/${itemId}/variations/${variationId}/images`),
        );
      }
    } catch {
      bilder = [];
    }
  }

  return {
    ...kern,
    itemId,
    titel,
    beschreibung,
    hersteller: null,
    bestand: vorab.bestand ?? 0,
    bildUrls: bilder,
    kategorie: null,
    // Der Zustand steht in Plenty nicht als Feld, das sich verlässlich lesen
    // ließe. „gebraucht" ist bei einem Verwerter der Normalfall und die
    // sichere Annahme: Sie löst keine der Pflichten aus, die an „neu" hängen
    // (siehe markenregeln.ts), sondern nur die schwächere Zusage.
    zustand: 'gebraucht',
  };
}
