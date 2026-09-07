/**
 * Lagerorte aus PlentyONE lesen.
 *
 * Wichtig gegenüber dem Bestands-Scan: Diese Liste enthält AUCH LEERE
 * Lagerorte. Aus einem Artikelexport lassen sich nur belegte Plätze ablesen —
 * daraus zu schließen, ein Platz existiere nicht, ist falsch. Genau dieser
 * Fehlschluss hat bei der Vorbereitung zweimal zu falschen Zahlen geführt.
 *
 * Endpunkt laut PlentyONE-REST-Doku:
 *   GET /rest/warehouses/{warehouseId}/locations   → „Lists all storage
 *   locations for the specified warehouse."
 *   Felder je Eintrag: id, levelId, label, fullLabel, purposeKey, statusKey,
 *   position, type, notes
 */

import { plentyGet } from './client';
import { findeLagerplaetze } from '@/lib/lagerplatz/erkennung';

/** Ein Lagerort, wie Plenty ihn führt. */
export interface Lagerort {
  /** Die ID, die beim Umbuchen als newStorageLocationId gebraucht wird. */
  id: number;
  /** Voller Name, z. B. "H1/R6/EA F05-K12". */
  name: string;
  /** Auf die einheitliche Form gebracht — null, wenn der Name nicht passt. */
  code: string | null;
  status: string | null;
  zweck: string | null;
}

/** Ein Lager (Warehouse). */
export interface Lager {
  id: number;
  name: string;
}

interface PlentyListe<T> {
  entries?: T[];
  isLastPage?: boolean;
  lastPageNumber?: number;
  totalsCount?: number;
}

/** Liest die Lager (Warehouses) mit ihren IDs. */
export async function ladeLager(): Promise<Lager[]> {
  const res = await plentyGet<PlentyListe<{ id?: number; name?: string }> | Array<{ id?: number; name?: string }>>(
    '/rest/stockmanagement/warehouses?itemsPerPage=250',
  );
  const eintraege = Array.isArray(res) ? res : (res?.entries ?? []);
  return eintraege
    .filter((w) => Number.isFinite(Number(w?.id)))
    .map((w) => ({ id: Number(w.id), name: w.name ?? `Lager ${w.id}` }));
}

/**
 * Liest alle Lagerorte eines Lagers — auch die leeren.
 * Gibt zusätzlich zurück, wie viele Namen sich nicht auf die einheitliche
 * Form bringen ließen; das ist der ehrliche Hinweis darauf, dass die
 * Zuordnung dort nicht greift.
 */
export async function ladeLagerorte(
  warehouseId: number,
  opts: { maxSeiten?: number; proSeite?: number } = {},
): Promise<{ orte: Lagerort[]; gelesen: number; ohneCode: number; abgebrochen: boolean }> {
  const proSeite = Math.min(250, Math.max(1, Math.floor(opts.proSeite ?? 250)));
  const maxSeiten = Math.max(1, Math.floor(opts.maxSeiten ?? 200));
  const orte: Lagerort[] = [];
  let ohneCode = 0;
  let seite = 1;
  let abgebrochen = true;

  for (; seite <= maxSeiten; seite++) {
    const res = await plentyGet<PlentyListe<Record<string, unknown>>>(
      `/rest/warehouses/${warehouseId}/locations?itemsPerPage=${proSeite}&page=${seite}`,
    );
    const eintraege = res?.entries ?? [];
    for (const e of eintraege) {
      const id = Number(e?.id);
      if (!Number.isFinite(id)) continue;
      const name = String(e?.fullLabel ?? e?.label ?? '').trim();
      const code = findeLagerplaetze(name)[0]?.code ?? null;
      if (!code) ohneCode += 1;
      orte.push({
        id,
        name,
        code,
        status: (e?.statusKey as string) ?? null,
        zweck: (e?.purposeKey as string) ?? null,
      });
    }
    if (res?.isLastPage || eintraege.length === 0 || (res?.lastPageNumber && seite >= Number(res.lastPageNumber))) {
      abgebrochen = false;
      break;
    }
  }

  return { orte, gelesen: orte.length, ohneCode, abgebrochen };
}

/**
 * Baut das Verzeichnis Code → Lagerort. Kommt ein Code mehrfach vor, gewinnt
 * der erste; die Dubletten werden gezählt, damit sie nicht stillschweigend
 * verschwinden.
 */
export function verzeichnis(orte: Lagerort[]): { nachCode: Map<string, Lagerort>; doppelt: number } {
  const nachCode = new Map<string, Lagerort>();
  let doppelt = 0;
  for (const o of orte) {
    if (!o.code) continue;
    if (nachCode.has(o.code)) doppelt += 1;
    else nachCode.set(o.code, o);
  }
  return { nachCode, doppelt };
}
