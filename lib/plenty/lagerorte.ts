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
  /** Der Strukturknoten (Feld), unter dem der Lagerort hängt. */
  levelId: number | null;
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
  opts: { maxSeiten?: number; proSeite?: number; gleichzeitig?: number } = {},
): Promise<{ orte: Lagerort[]; gelesen: number; ohneCode: number; abgebrochen: boolean }> {
  // Die Namen ohne erkennbaren Code sind der wichtigste Hinweis, wenn etwas
  // nicht stimmt — sie stehen deshalb als Beispiele in der Oberfläche.
  const proSeite = Math.min(250, Math.max(1, Math.floor(opts.proSeite ?? 250)));
  const maxSeiten = Math.max(1, Math.floor(opts.maxSeiten ?? 200));
  const gleichzeitig = Math.min(10, Math.max(1, Math.floor(opts.gleichzeitig ?? 4)));
  const orte: Lagerort[] = [];
  let ohneCode = 0;
  let abgebrochen = true;

  const seiteLesen = (seite: number) =>
    plentyGet<PlentyListe<Record<string, unknown>>>(
      `/rest/warehouses/${warehouseId}/locations?itemsPerPage=${proSeite}&page=${seite}`,
    );

  /**
   * Ist diese Seite die letzte? Sagt Plenty es ausdrücklich, gilt die Angabe —
   * auch ein „nein" bei kurzer Seite. Fehlt die Angabe, ist eine nicht volle
   * Seite das Ende.
   */
  const fertig = (res: PlentyListe<Record<string, unknown>> | null, anzahl: number) => {
    if (typeof res?.isLastPage === 'boolean') return res.isLastPage;
    return anzahl === 0 || anzahl < proSeite;
  };

  const uebernimm = (res: PlentyListe<Record<string, unknown>> | null) => {
    for (const e of res?.entries ?? []) {
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
        levelId: Number.isFinite(Number(e?.levelId)) ? Number(e.levelId) : null,
      });
    }
  };

  // Erste Seite einzeln — sie verrät, wie viele es insgesamt sind.
  const erste = await seiteLesen(1);
  const ersteAnzahl = (erste?.entries ?? []).length;
  uebernimm(erste);
  const letzte = Number(erste?.lastPageNumber ?? 0);

  if (fertig(erste, ersteAnzahl)) {
    return { orte, gelesen: orte.length, ohneCode, abgebrochen: false };
  }

  if (letzte > 1) {
    // Seitenzahl bekannt: die restlichen Seiten in Gruppen gleichzeitig holen.
    // Nacheinander dauert das bei einem grossen Lager (12.000 Lagerorte sind
    // rund 50 Seiten) laenger als das Zeitbudget einer Anfrage.
    const seiten: number[] = [];
    for (let s = 2; s <= Math.min(letzte, maxSeiten); s++) seiten.push(s);
    for (let i = 0; i < seiten.length; i += gleichzeitig) {
      const gruppe = await Promise.all(seiten.slice(i, i + gleichzeitig).map(seiteLesen));
      for (const res of gruppe) uebernimm(res);
    }
    abgebrochen = letzte > maxSeiten;
    return { orte, gelesen: orte.length, ohneCode, abgebrochen };
  }

  // Ohne Seitenzahl bleibt nur, sich vorzutasten.
  for (let seite = 2; seite <= maxSeiten; seite++) {
    const res = await seiteLesen(seite);
    const anzahl = (res?.entries ?? []).length;
    uebernimm(res);
    if (fertig(res, anzahl)) {
      abgebrochen = false;
      break;
    }
  }

  return { orte, gelesen: orte.length, ohneCode, abgebrochen };
}

/** Das, was `ladeLagerorte` liefert — so hält es auch der Puffer fest. */
export interface Lagerortliste {
  orte: Lagerort[];
  gelesen: number;
  ohneCode: number;
  abgebrochen: boolean;
}

/** Wie lange eine gelesene Liste als frisch gilt. */
export const PUFFER_DAUER_MS = 10 * 60_000;

const puffer = new Map<number, { zeit: number; liste: Lagerortliste }>();
const laufend = new Map<number, Promise<Lagerortliste>>();

/**
 * Liest die Lagerorte eines Lagers — aber höchstens einmal je Zeitfenster.
 *
 * Ein Buchungslauf besteht aus vielen Teilaufrufen, und jeder brauchte bisher
 * die ganze Liste: Bei 13.000 Lagerorten sind das 53 Seiten — mal 170 Runden
 * über 9.000 Leseabfragen. Genau daran zieht PlentyONE die Lesebremse
 * ("short period read limit reached"), und der Lauf bleibt stehen.
 *
 * Gepuffert wird nur eine vollständig gelesene Liste; eine abgeschnittene
 * wäre eine stille Lüge. Läuft schon ein Lesevorgang, hängen sich weitere
 * Aufrufer an denselben an, statt ein zweites Mal zu fragen.
 */
export async function ladeLagerorteGepuffert(
  warehouseId: number,
  opts: { maxAlterMs?: number; frisch?: boolean } = {},
): Promise<Lagerortliste & { ausPuffer: boolean; alterMs: number }> {
  const maxAlter = Math.max(0, Math.floor(opts.maxAlterMs ?? PUFFER_DAUER_MS));

  if (!opts.frisch) {
    const treffer = puffer.get(warehouseId);
    const alter = treffer ? Date.now() - treffer.zeit : Infinity;
    // `maxAlterMs: 0` heisst "auf jeden Fall frisch" — nicht "alles im selben
    // Millisekundenschlag gilt noch".
    if (treffer && maxAlter > 0 && alter <= maxAlter) {
      return { ...treffer.liste, ausPuffer: true, alterMs: alter };
    }
  }

  const schon = laufend.get(warehouseId);
  if (schon) return { ...(await schon), ausPuffer: false, alterMs: 0 };

  const lauf = ladeLagerorte(warehouseId)
    .then((liste) => {
      // Nur vollständige Listen dürfen in den Puffer.
      if (!liste.abgebrochen) puffer.set(warehouseId, { zeit: Date.now(), liste });
      return liste;
    })
    .finally(() => laufend.delete(warehouseId));
  laufend.set(warehouseId, lauf);

  return { ...(await lauf), ausPuffer: false, alterMs: 0 };
}

/**
 * Wirft den Puffer weg — nötig, sobald Lagerorte angelegt oder gelöscht
 * wurden, damit der nächste Lauf die neuen auch sieht.
 */
export function leereLagerortPuffer(warehouseId?: number): void {
  if (warehouseId === undefined) puffer.clear();
  else puffer.delete(warehouseId);
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
