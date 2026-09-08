/**
 * Artikel einem Lagerort zuweisen — durch Umbuchen des Bestands.
 *
 * In PlentyONE gibt es keine reine Zuordnung: Ein Artikel liegt auf einem
 * Lagerort, indem sein Bestand dorthin gebucht ist. Die Zuweisung ist also
 * eine Umlagerung vom Standard-Lagerort auf den richtigen Platz.
 *
 * Endpunkt laut PlentyONE-REST-Doku:
 *   PUT /rest/items/{itemId}/variations/{variationId}/stock/redistribute
 *   Body: reasonId (401 = Umlagerung), quantity,
 *         currentWarehouseId, currentStorageLocationId,
 *         newWarehouseId, newStorageLocationId
 *
 * DIESER VORGANG BEWEGT ECHTEN BESTAND. Deshalb:
 *   - `probelauf: true` ist die Voreinstellung; dann wird nichts geschrieben.
 *   - Jede Buchung wird protokolliert (von wo, wohin, wie viel).
 *   - Ein Fehler stoppt nicht den ganzen Lauf, sondern wird je Zeile vermerkt.
 */

import { getPlentyConfig, plentyConfigured, plentyGet, plentyToken } from './client';
import { ladeLagerorte, verzeichnis, type Lagerort } from './lagerorte';

/** Grund 401 = Umlagerung (laut Plenty-Doku: „Stock transfer"). */
export const GRUND_UMLAGERUNG = 401;

/** Eine gewünschte Zuweisung, wie sie aus der Auswertung kommt. */
export interface Wunsch {
  variationId: number;
  /** Artikel-ID; wird nachgeladen, wenn sie fehlt. */
  itemId?: number | null;
  /** Ziel-Lagerplatz in der einheitlichen Form, z. B. "H1/R6/EA F05-K12". */
  ziel: string;
  /** Wie viel umgebucht werden soll. Fehlt sie, wird der offene Bestand genommen. */
  menge?: number | null;
}

export type ZeilenStatus = 'geplant' | 'gebucht' | 'uebersprungen' | 'fehler';

/** Was mit einer Zeile passiert ist. */
export interface Zeile {
  variationId: number;
  itemId: number | null;
  ziel: string;
  zielId: number | null;
  zielName: string | null;
  menge: number | null;
  status: ZeilenStatus;
  hinweis: string | null;
}

export interface ZuweisungErgebnis {
  ok: boolean;
  probelauf: boolean;
  error: string | null;
  warehouseId: number | null;
  /** Lagerorte, die aus Plenty gelesen wurden. */
  lagerorte: number;
  geplant: number;
  gebucht: number;
  uebersprungen: number;
  fehler: number;
  zeilen: Zeile[];
  diagnose: string[];
  dauerMs: number;
}

export interface ZuweisungOptionen {
  warehouseId: number;
  /** Ohne ausdrückliches `probelauf: false` wird nichts geschrieben. */
  probelauf?: boolean;
  /** Von welchem Lagerort umgebucht wird. 0 = Standard-Lagerort. */
  vonLagerortId?: number;
  /** Obergrenze für tatsächliche Buchungen je Aufruf. */
  maxBuchungen?: number;
}

interface PlentyVariante { id?: number; itemId?: number }
interface PlentyBestand { variationId?: number; storageLocationId?: number; quantity?: number }

/** Arbeitet eine Liste in kleinen Gruppen ab (schont die API). */
async function inGruppen<T, R>(werte: T[], groesse: number, fn: (wert: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < werte.length; i += groesse) {
    out.push(...(await Promise.all(werte.slice(i, i + groesse).map(fn))));
  }
  return out;
}

/** Holt die Artikel-IDs zu Varianten, die keine mitbringen. */
async function ergaenzeItemIds(wuensche: Wunsch[], diagnose: string[]): Promise<Map<number, number>> {
  const offen = [...new Set(wuensche.filter((w) => !w.itemId).map((w) => w.variationId))];
  const map = new Map<number, number>();
  if (!offen.length) return map;

  for (let i = 0; i < offen.length; i += 50) {
    const gruppe = offen.slice(i, i + 50);
    try {
      const res = await plentyGet<{ entries?: PlentyVariante[] }>(
        `/rest/items/variations?id=${gruppe.join(',')}&itemsPerPage=${gruppe.length}`,
      );
      for (const v of res?.entries ?? []) {
        if (Number.isFinite(Number(v?.id)) && Number.isFinite(Number(v?.itemId))) {
          map.set(Number(v.id), Number(v.itemId));
        }
      }
    } catch (err) {
      diagnose.push(`Artikel-IDs für ${gruppe.length} Varianten nicht ladbar: ${(err as Error).message.slice(0, 120)}`);
    }
  }
  return map;
}

/** Liest, wie viel auf dem Quell-Lagerort liegt — die Obergrenze der Umbuchung. */
async function bestandAmQuellort(
  warehouseId: number,
  variationId: number,
  vonLagerortId: number,
): Promise<number | null> {
  try {
    const res = await plentyGet<{ entries?: PlentyBestand[] }>(
      `/rest/stockmanagement/warehouses/${warehouseId}/stock/storageLocations?variationId=${variationId}&itemsPerPage=50`,
    );
    const zeilen = res?.entries ?? [];
    const treffer = zeilen.filter((z) => Number(z?.storageLocationId ?? 0) === vonLagerortId);
    if (!treffer.length) return null;
    return treffer.reduce((a, z) => a + (Number(z?.quantity) || 0), 0);
  } catch {
    return null;
  }
}

/** Führt die eigentliche Umbuchung aus. */
async function bucheUm(
  itemId: number,
  variationId: number,
  body: Record<string, number>,
): Promise<{ ok: boolean; meldung: string }> {
  const cfg = getPlentyConfig();
  const token = await plentyToken(cfg);
  const res = await fetch(
    `${cfg.baseUrl}/rest/items/${itemId}/variations/${variationId}/stock/redistribute?itemId=${itemId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  return { ok: res.ok, meldung: res.ok ? 'ok' : `HTTP ${res.status}: ${text.slice(0, 200)}` };
}

/**
 * Plant die Zuweisungen und führt sie aus (im Probelauf nur planen).
 * Wirft nie — Fehler landen je Zeile im Protokoll.
 */
export async function weiseZu(wuensche: Wunsch[], opts: ZuweisungOptionen): Promise<ZuweisungErgebnis> {
  const start = Date.now();
  const probelauf = opts.probelauf !== false;
  const vonLagerortId = Math.max(0, Math.floor(opts.vonLagerortId ?? 0));
  const maxBuchungen = Math.max(0, Math.floor(opts.maxBuchungen ?? 50));
  const diagnose: string[] = [];
  const zeilen: Zeile[] = [];

  const leer: ZuweisungErgebnis = {
    ok: false, probelauf, error: null, warehouseId: opts.warehouseId, lagerorte: 0,
    geplant: 0, gebucht: 0, uebersprungen: 0, fehler: 0, zeilen, diagnose, dauerMs: 0,
  };

  if (!plentyConfigured(getPlentyConfig())) {
    return { ...leer, error: 'PlentyONE ist nicht konfiguriert.', dauerMs: Date.now() - start };
  }

  let nachCode: Map<string, Lagerort>;
  let anzahlOrte = 0;
  try {
    const { orte, ohneCode, abgebrochen } = await ladeLagerorte(opts.warehouseId);
    anzahlOrte = orte.length;
    const v = verzeichnis(orte);
    nachCode = v.nachCode;
    diagnose.push(`${orte.length} Lagerorte gelesen, ${v.nachCode.size} davon eindeutig zuordenbar.`);
    if (ohneCode) diagnose.push(`${ohneCode} Lagerort-Namen folgen nicht dem bekannten Schema und bleiben unberücksichtigt.`);
    if (v.doppelt) diagnose.push(`${v.doppelt} Lagerorte tragen denselben Code doppelt — es wird jeweils der erste genommen.`);
    if (abgebrochen) diagnose.push('Die Lagerort-Liste war länger als erwartet und wurde abgeschnitten.');
  } catch (err) {
    return { ...leer, error: `Lagerorte nicht lesbar: ${(err as Error).message}`, dauerMs: Date.now() - start };
  }

  // Artikel-IDs kosten je 50 Varianten einen API-Aufruf. Im Probelauf werden
  // sie nicht gebraucht (es wird ja nichts geschrieben), und beim Buchen nur
  // für die Zeilen, die tatsächlich drankommen — sonst läuft der Aufruf bei
  // mehreren tausend Zeilen in den Serverless-Timeout.
  let itemIds = new Map<number, number>();
  if (!probelauf) {
    const buchbar = wuensche.filter((w) => nachCode.has(w.ziel)).slice(0, maxBuchungen);
    itemIds = await ergaenzeItemIds(buchbar, diagnose);
  }

  let gebucht = 0, uebersprungen = 0, fehler = 0, geplant = 0;

  for (const w of wuensche) {
    const ziel = nachCode.get(w.ziel);
    const itemId = w.itemId ?? itemIds.get(w.variationId) ?? null;
    const basis = { variationId: w.variationId, itemId, ziel: w.ziel, zielId: ziel?.id ?? null, zielName: ziel?.name ?? null };

    if (!ziel) {
      zeilen.push({ ...basis, menge: null, status: 'uebersprungen', hinweis: 'Lagerort existiert in Plenty nicht' });
      uebersprungen++; continue;
    }

    let menge = w.menge ?? null;
    // Nur nachschlagen, wenn wirklich gebucht wird — ein Aufruf je Artikel.
    if ((menge === null || menge <= 0) && !probelauf && gebucht < maxBuchungen) {
      menge = await bestandAmQuellort(opts.warehouseId, w.variationId, vonLagerortId);
    }
    // Im Probelauf wird die Menge nicht nachgeschlagen (ein Aufruf je Artikel).
    // Eine unbekannte Menge ist dort kein Grund zum Überspringen — sie wird
    // beim Buchen ermittelt.
    if ((menge === null || menge <= 0) && !probelauf) {
      zeilen.push({ ...basis, menge, status: 'uebersprungen', hinweis: 'Auf dem Quell-Lagerort liegt nichts' });
      uebersprungen++; continue;
    }

    geplant++;
    if (probelauf) {
      zeilen.push({
        ...basis,
        menge,
        status: 'geplant',
        hinweis: menge === null ? 'Menge wird beim Buchen aus dem Bestand ermittelt' : null,
      });
      continue;
    }
    // Ab hier wird wirklich gebucht — ohne Menge geht das nicht.
    if (menge === null || menge <= 0) {
      zeilen.push({ ...basis, menge, status: 'uebersprungen', hinweis: 'Menge nicht ermittelbar' });
      uebersprungen++; continue;
    }
    if (!itemId) {
      zeilen.push({ ...basis, menge, status: 'uebersprungen', hinweis: 'Artikel-ID nicht ermittelbar' });
      uebersprungen++; continue;
    }
    if (gebucht >= maxBuchungen) {
      zeilen.push({ ...basis, menge, status: 'uebersprungen', hinweis: `Obergrenze von ${maxBuchungen} Buchungen erreicht` });
      uebersprungen++; continue;
    }

    const res = await bucheUm(itemId, w.variationId, {
      reasonId: GRUND_UMLAGERUNG,
      quantity: menge,
      currentWarehouseId: opts.warehouseId,
      currentStorageLocationId: vonLagerortId,
      newWarehouseId: opts.warehouseId,
      newStorageLocationId: ziel.id,
    });
    if (res.ok) { zeilen.push({ ...basis, menge, status: 'gebucht', hinweis: null }); gebucht++; }
    else { zeilen.push({ ...basis, menge, status: 'fehler', hinweis: res.meldung }); fehler++; }
  }

  return {
    ...leer, ok: true, lagerorte: anzahlOrte,
    geplant, gebucht, uebersprungen, fehler, zeilen, dauerMs: Date.now() - start,
  };
}
