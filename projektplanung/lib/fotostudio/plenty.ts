/**
 * Fotostudio — die Aufrufe gegen Plenty.
 *
 * Aufgeteilt in „Artikel anlegen" und „ein Bild übertragen", und beides
 * wiederholbar: Jeder Aufruf schaut zuerst in den gespeicherten Stand, was
 * schon erledigt ist. Ein zweiter Anlauf nach einem Funkloch legt also keinen
 * zweiten Artikel an und hängt kein Bild doppelt an.
 *
 * Bilder gehen einzeln, weil Serverless-Funktionen nach 60 Sekunden enden —
 * zwölf Fotos in einem Aufruf reißen die Grenze, und dann weiß niemand, wie
 * viele oben sind. Plenty holt jedes Bild selbst über eine signierte Adresse
 * ab (`uploadUrl`, wie im Make-Szenario). Damit fließen die Megabytes nicht
 * durch unsere Funktion, und die volle Auflösung bleibt erhalten.
 */

import { PDFDocument } from 'pdf-lib';
import { aktuelleConfig, plentyConfigured, plentyGet, plentyJson, plentyToken, type PlentyConfig } from '@/lib/plenty/client';
import { generateEan13 } from '@/lib/plenty/ean';
import type { Zustand } from '@/lib/preis/regelwerk';
import { baueItem, type FotostudioKonfig, type PlentyStand } from './kern';
import { etikettBase64, gtinAn, leseVorlagen, type Nummernkreis, type Vorlage } from './gtin';

function fehlertext(err: unknown): string {
  const text = (err as Error)?.message ?? String(err);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

interface ItemAntwort {
  id?: number;
  mainVariationId?: number;
  variations?: Array<{ id?: number; isMain?: boolean }>;
}

export interface AnlageEingabe {
  nummer: number;
  zustand: Zustand;
  bestand: number;
  gewichtKg: number | null;
  /**
   * Ab hier wird im Nummernkreis gesucht — die höchste schon vergebene
   * Position plus eins. Die Route liest sie aus der Datenbank.
   */
  startVersatz: number;
}

export interface AnlageAntwort {
  stand: PlentyStand;
  /** Gesetzt, wenn der Artikel selbst nicht entstanden ist. */
  fehler: string | null;
}

export async function plentyBereit(): Promise<{ cfg: PlentyConfig } | { fehler: string }> {
  const cfg = await aktuelleConfig();
  if (!plentyConfigured(cfg)) return { fehler: 'PlentyONE ist nicht eingerichtet (siehe Einstellungen).' };
  return { cfg };
}

/** So viele belegte Nummern werden höchstens übersprungen, bevor aufgegeben wird. */
export const MAX_GTIN_VERSUCHE = 25;

/** Hängt schon eine Variante an dieser Nummer? */
async function gtinVergeben(code: string, cfg: PlentyConfig): Promise<boolean> {
  const antwort = await plentyGet<{ totalsCount?: number; entries?: unknown[] }>(
    `/rest/items/variations?barcode=${encodeURIComponent(code)}&itemsPerPage=1`,
    cfg,
  );
  return (antwort?.totalsCount ?? antwort?.entries?.length ?? 0) > 0;
}

/**
 * Vergibt die EAN und hängt sie an die Variante.
 *
 * Mit Nummernkreis: die nächste Nummer, die in Plenty an keiner Variante
 * hängt — wie der Knopf „Barcode generieren". Ohne Nummernkreis: der interne
 * 20er-Bereich aus der laufenden Nummer, damit trotzdem ein Etikett entsteht.
 */
async function eanVergeben(
  e: AnlageEingabe,
  stand: PlentyStand,
  kreis: Nummernkreis | null,
  cfg: PlentyConfig,
): Promise<void> {
  if (stand.ean) return;
  if (!cfg.eanBarcodeId) {
    stand.offen.push('Keine EAN vergeben: PLENTY_EAN_BARCODE_ID (Barcode EAN13_2) ist nicht eingerichtet.');
    return;
  }

  const anhaengen = (code: string) =>
    plentyJson(
      'POST',
      `/rest/items/${stand.itemId}/variations/${stand.variationId}/variation_barcodes`,
      { barcodeId: cfg.eanBarcodeId, variationId: stand.variationId, code },
      cfg,
    );

  if (!kreis) {
    const code = generateEan13(e.nummer, cfg.eanPrefix);
    try {
      await anhaengen(code);
      stand.ean = code;
      stand.eanQuelle = 'intern';
      stand.offen.push('EAN aus dem internen Bereich (20…) — für den Plenty-Nummernkreis FOTOSTUDIO_GTIN_START setzen.');
    } catch (err) {
      stand.offen.push(`EAN nicht an die Variante gehängt: ${fehlertext(err)}`);
    }
    return;
  }

  for (let i = 0; i < MAX_GTIN_VERSUCHE; i += 1) {
    const code = gtinAn(kreis, e.startVersatz + i);
    if (!code) {
      stand.offen.push('GTIN-Nummernkreis ist aufgebraucht — in Plenty unter Einrichtung » Artikel » GTIN erweitern.');
      return;
    }
    try {
      if (await gtinVergeben(code, cfg)) continue;
      await anhaengen(code);
      stand.ean = code;
      stand.eanQuelle = 'nummernkreis';
      return;
    } catch (err) {
      // Zwischen Prüfen und Anhängen kann jemand dieselbe Nummer in Plenty
      // vergeben haben — dann lehnt Plenty die doppelte Kombination ab, und es
      // geht mit der nächsten weiter. Jeder andere Fehler bricht ab.
      if (/duplicate|unique|already|bereits|exist/i.test(fehlertext(err))) continue;
      stand.offen.push(`EAN nicht an die Variante gehängt: ${fehlertext(err)}`);
      return;
    }
  }
  stand.offen.push(`${MAX_GTIN_VERSUCHE} Nummern hintereinander schon vergeben — EAN bitte in Plenty generieren.`);
}

/**
 * Legt den Artikel an, vergibt die EAN und bucht den Bestand — jeweils nur,
 * wenn noch nicht geschehen.
 */
export async function artikelAnlegen(
  e: AnlageEingabe,
  stand: PlentyStand,
  konfig: FotostudioKonfig,
  kreis: Nummernkreis | null,
  cfg: PlentyConfig,
): Promise<AnlageAntwort> {
  const neu: PlentyStand = { ...stand, bilder: { ...stand.bilder }, offen: [] };

  if (!neu.itemId || !neu.variationId) {
    // Ohne Barcode anlegen: Die EAN kommt erst, wenn feststeht, welche Nummer
    // im Kreis frei ist — und dafür braucht es die Variante.
    const rumpf = baueItem({ zustand: e.zustand, gewichtKg: e.gewichtKg }, konfig, { plentyId: cfg.plentyId });
    try {
      const antwort = await plentyJson<ItemAntwort>('POST', '/rest/items', rumpf, cfg);
      const haupt = (antwort?.variations ?? []).find((v) => v.isMain) ?? antwort?.variations?.[0];
      neu.itemId = antwort?.id ?? null;
      neu.variationId = antwort?.mainVariationId ?? haupt?.id ?? null;
    } catch (err) {
      return { stand: neu, fehler: `Artikel konnte nicht angelegt werden: ${fehlertext(err)}` };
    }
    if (!neu.itemId || !neu.variationId) {
      return { stand: neu, fehler: 'Plenty lieferte keine Artikel- oder Varianten-ID zurück.' };
    }
  }

  await eanVergeben(e, neu, kreis, cfg);

  // Bestand als Korrekturbuchung: Plenty führt Bestände über Bewegungen, ein
  // direkt gesetzter Wert wäre beim nächsten Lagerabgleich wieder weg.
  if (!neu.bestandGebucht) {
    if (!konfig.warehouseId) {
      neu.offen.push('Bestand nicht gebucht: kein Lager hinterlegt (FOTOSTUDIO_WAREHOUSE_ID / PLENTY_WAREHOUSE_ID).');
    } else {
      try {
        await plentyJson(
          'PUT',
          `/rest/stockmanagement/warehouses/${konfig.warehouseId}/stock/correction`,
          { variationId: neu.variationId, quantity: e.bestand, reasonId: 501 },
          cfg,
        );
        neu.bestandGebucht = true;
      } catch (err) {
        neu.offen.push(`Bestand nicht gebucht: ${fehlertext(err)}`);
      }
    }
  }

  return { stand: neu, fehler: null };
}

// ---------------------------------------------------------------------------
// Etikett aus Plenty
// ---------------------------------------------------------------------------

/** Die Artikel-Etikettvorlagen aus Plenty (`GET /rest/items/labels`). */
export async function etikettVorlagen(cfg: PlentyConfig): Promise<Vorlage[]> {
  return leseVorlagen(await plentyGet<unknown>('/rest/items/labels', cfg));
}

/**
 * Holt das Etikett der Variante aus der Plenty-Vorlage als PDF.
 *
 * Eigener Abruf statt `plentyJson`: Je nach Version antwortet Plenty mit
 * nacktem base64 statt JSON, und daran scheiterte der JSON-Weg.
 */
export async function etikettVonPlenty(
  itemId: number,
  variationId: number,
  labelId: number,
  cfg: PlentyConfig,
): Promise<Uint8Array> {
  const token = await plentyToken(cfg);
  const res = await fetch(`${cfg.baseUrl}/rest/items/${itemId}/variations/${variationId}/labels`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ labelId }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Plenty-Etikett → HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  const base64 = etikettBase64(text);
  if (!base64) throw new Error(`Plenty lieferte kein PDF als Etikett. Antwort-Anfang: "${text.slice(0, 120)}"`);
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/** Ein Etikett je Stück: alle Seiten des Plenty-PDFs `anzahl`-mal hintereinander. */
export async function vervielfachen(pdf: Uint8Array, anzahl: number): Promise<Uint8Array> {
  const quelle = await PDFDocument.load(pdf);
  const ziel = await PDFDocument.create();
  const indizes = quelle.getPageIndices();
  for (let i = 0; i < anzahl; i += 1) {
    const seiten = await ziel.copyPages(quelle, indizes);
    for (const seite of seiten) ziel.addPage(seite);
  }
  return ziel.save();
}

/**
 * Überträgt ein Bild und hängt es an die Variante.
 *
 * Ohne die Zuordnung zeigt Plenty das Bild am Artikel, aber nicht an der
 * Variante — und verkauft wird die Variante. Schlägt nur die Zuordnung fehl,
 * zählt das Bild trotzdem als oben (sonst lüde der nächste Anlauf es doppelt
 * hoch); der fehlende Schritt steht als offener Punkt dabei.
 */
export async function bildUebertragen(
  itemId: number,
  variationId: number,
  bild: { url: string; dateiname: string; position: number },
  cfg: PlentyConfig,
): Promise<{ imageId: number; hinweis: string | null }> {
  const angelegt = await plentyJson<{ id?: number }>(
    'POST',
    `/rest/items/${itemId}/images/upload`,
    { uploadUrl: bild.url, uploadFileName: bild.dateiname, position: bild.position },
    cfg,
  );
  const imageId = angelegt?.id;
  if (!imageId) throw new Error('Plenty lieferte keine Bild-ID zurück.');

  try {
    await plentyJson(
      'POST',
      `/rest/items/${itemId}/variations/${variationId}/variation_images`,
      { imageId, variationId },
      cfg,
    );
    return { imageId, hinweis: null };
  } catch (err) {
    return { imageId, hinweis: `Bild ${bild.position + 1} nicht mit der Variante verknüpft: ${fehlertext(err)}` };
  }
}
