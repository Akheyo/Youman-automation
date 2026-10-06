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

import { aktuelleConfig, plentyConfigured, plentyJson, type PlentyConfig } from '@/lib/plenty/client';
import { generateEan13 } from '@/lib/plenty/ean';
import type { Zustand } from '@/lib/preis/regelwerk';
import { baueItem, type FotostudioKonfig, type PlentyStand } from './kern';

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
  ean: string | null;
}

export interface AnlageAntwort {
  stand: PlentyStand;
  ean: string | null;
  /** Gesetzt, wenn der Artikel selbst nicht entstanden ist. */
  fehler: string | null;
}

export async function plentyBereit(): Promise<{ cfg: PlentyConfig } | { fehler: string }> {
  const cfg = await aktuelleConfig();
  if (!plentyConfigured(cfg)) return { fehler: 'PlentyONE ist nicht eingerichtet (siehe Einstellungen).' };
  return { cfg };
}

/**
 * Legt den Artikel an und bucht den Bestand — jeweils nur, wenn noch nicht
 * geschehen.
 */
export async function artikelAnlegen(
  e: AnlageEingabe,
  stand: PlentyStand,
  konfig: FotostudioKonfig,
  cfg: PlentyConfig,
): Promise<AnlageAntwort> {
  const neu: PlentyStand = { ...stand, bilder: { ...stand.bilder }, offen: [] };

  // EAN aus der laufenden Nummer — deterministisch, ein zweiter Anlauf vergibt
  // dieselbe. Erzeugt wird sie immer, weil das Etikett sie braucht; an die
  // Variante kommt sie über die Barcode-Konfiguration (EAN13_2).
  const ean = e.ean ?? generateEan13(e.nummer, cfg.eanPrefix);
  if (!cfg.eanBarcodeId) {
    neu.offen.push('EAN nicht als Barcode in Plenty: PLENTY_EAN_BARCODE_ID (EAN13_2) fehlt.');
  }

  if (!neu.itemId || !neu.variationId) {
    const rumpf = baueItem({ zustand: e.zustand, gewichtKg: e.gewichtKg, ean }, konfig, {
      plentyId: cfg.plentyId,
      eanBarcodeId: cfg.eanBarcodeId,
    });
    try {
      const antwort = await plentyJson<ItemAntwort>('POST', '/rest/items', rumpf, cfg);
      const haupt = (antwort?.variations ?? []).find((v) => v.isMain) ?? antwort?.variations?.[0];
      neu.itemId = antwort?.id ?? null;
      neu.variationId = antwort?.mainVariationId ?? haupt?.id ?? null;
    } catch (err) {
      return { stand: neu, ean, fehler: `Artikel konnte nicht angelegt werden: ${fehlertext(err)}` };
    }
    if (!neu.itemId || !neu.variationId) {
      return { stand: neu, ean, fehler: 'Plenty lieferte keine Artikel- oder Varianten-ID zurück.' };
    }
  }

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

  return { stand: neu, ean, fehler: null };
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
