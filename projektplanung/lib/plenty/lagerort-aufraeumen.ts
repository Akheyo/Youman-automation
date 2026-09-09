/**
 * Falsch angelegte Lagerorte samt ihrer Struktur wieder entfernen.
 *
 * WAS SCHIEFGING
 * --------------
 * In PlentyONE steht das Kürzel der Spalte IM NAMEN des Knotens: Die Halle
 * heißt "H1", nicht "1"; das Regal "R7", die Ebene "EC", das Feld "F16". Die
 * Anlage suchte ohne Kürzel, fand nichts und legte einen kompletten zweiten
 * Baum an — sechs Hallen "1" bis "6" mit allem darunter. Die Lagerorte darin
 * heißen "1/7/C 16-K01" statt "H1/R7/EC F16-K01" und sind damit weder in der
 * Plenty-Maske auffindbar noch für die Zuweisung brauchbar.
 *
 * WIE ERKANNT WIRD, WAS WEG SOLL
 * ------------------------------
 * Nicht über Zeitstempel und nicht über IDs, sondern über die Regel, an der
 * man es auch von Hand sieht: Ein oberster Knoten, dessen Name NICHT mit dem
 * Kürzel seiner Spalte beginnt, gehört nicht in den Baum. Alles darunter
 * hängt an ihm.
 *
 * SCHUTZ
 * ------
 *   - `probelauf: true` ist Voreinstellung; dann wird nichts gelöscht.
 *   - Lagerorte MIT BESTAND werden nie gelöscht — der Lauf bricht dann ab.
 *     Auf dem falschen Baum liegt zwar nichts, aber verlassen wird sich
 *     darauf nicht.
 *   - Gelöscht wird von unten nach oben: erst die Lagerorte, dann die
 *     Knoten von der tiefsten Stufe aufwärts.
 *   - Zeitbudget und Schreiblimit wie beim Anlegen.
 *
 * Endpunkte laut PlentyONE-REST-Doku:
 *   DELETE /rest/warehouses/locations/{warehouseLocationId}
 *   DELETE /rest/warehouses/locations/levels/{warehouseLocationLevelId}
 */

import { plentyDelete, plentyGet } from './client';
import { ladeLagerorte, type Lagerort } from './lagerorte';
import { istSchreiblimit, ladeStruktur, type Knoten } from './lagerort-anlegen';

/** Ein Zweig, der nicht in den Baum gehört. */
export interface FalscherZweig {
  /** Der oberste Knoten des Zweigs. */
  wurzel: Knoten;
  /** Alle Knoten des Zweigs, oberster zuerst. */
  knoten: Knoten[];
  /** Die Lagerorte, die darin hängen. */
  orte: Lagerort[];
}

export interface AufraeumErgebnis {
  ok: boolean;
  probelauf: boolean;
  error: string | null;
  /** Zweige, die entfernt werden sollen — mit Beispielen zum Nachsehen. */
  zweige: Array<{ wurzelId: number; name: string; knoten: number; orte: number; beispiele: string[] }>;
  orteGesamt: number;
  knotenGesamt: number;
  orteGeloescht: number;
  knotenGeloescht: number;
  fehler: number;
  offen: number;
  schreiblimit: boolean;
  meldungen: string[];
  diagnose: string[];
  dauerMs: number;
}

export interface AufraeumOptionen {
  warehouseId: number;
  /** Ohne ausdrückliches `probelauf: false` wird nichts gelöscht. */
  probelauf?: boolean;
  /** Obergrenze für tatsächliche Löschungen je Aufruf. */
  maxLoeschungen?: number;
  budgetMs?: number;
  /** Nur diese Wurzeln aufräumen. Leer = alle erkannten. */
  nurWurzeln?: number[];
}

interface PlentyBestand {
  storageLocationId?: number;
  quantity?: number;
}

function warte(ms: number): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, ms));
}

async function loescheMitGeduld(pfad: string, versuche = 3): Promise<void> {
  for (let versuch = 1; ; versuch++) {
    try {
      await plentyDelete(pfad);
      return;
    } catch (err) {
      if (versuch >= versuche || !istSchreiblimit(err)) throw err;
      await warte(2_000 * versuch);
    }
  }
}

/**
 * Findet die Zweige, die nicht in den Baum gehören: oberste Knoten, deren
 * Name nicht mit dem Kürzel ihrer Spalte beginnt.
 */
export function findeFalscheZweige(
  knoten: Knoten[],
  orte: Lagerort[],
  halleDimensionId: number,
  halleKuerzel: string,
): FalscherZweig[] {
  const oberste = knoten.filter((k) => k.dimensionId === halleDimensionId && k.parentId === 0);
  const falsch = halleKuerzel
    ? oberste.filter((k) => !k.name.toUpperCase().startsWith(halleKuerzel.toUpperCase()))
    : [];
  if (!falsch.length) return [];

  // Kinder je Elternknoten, damit der Zweig in einem Durchgang einsammelbar ist.
  const kinder = new Map<number, Knoten[]>();
  for (const k of knoten) {
    const liste = kinder.get(k.parentId) ?? [];
    liste.push(k);
    kinder.set(k.parentId, liste);
  }

  const orteJeLevel = new Map<number, Lagerort[]>();
  for (const o of orte) {
    if (o.levelId === null) continue;
    const liste = orteJeLevel.get(o.levelId) ?? [];
    liste.push(o);
    orteJeLevel.set(o.levelId, liste);
  }

  return falsch.map((wurzel) => {
    const gesammelt: Knoten[] = [];
    const stapel = [wurzel];
    while (stapel.length) {
      const k = stapel.pop() as Knoten;
      gesammelt.push(k);
      stapel.push(...(kinder.get(k.id) ?? []));
    }
    const zweigOrte = gesammelt.flatMap((k) => orteJeLevel.get(k.id) ?? []);
    return { wurzel, knoten: gesammelt, orte: zweigOrte };
  });
}

/** Liest, auf welchen dieser Lagerorte Bestand liegt. */
async function mitBestand(warehouseId: number, orte: Lagerort[]): Promise<Set<number>> {
  const belegt = new Set<number>();
  const ids = new Set(orte.map((o) => o.id));
  if (!ids.size) return belegt;

  for (let seite = 1; seite <= 200; seite++) {
    const res = await plentyGet<{ entries?: PlentyBestand[]; isLastPage?: boolean }>(
      `/rest/stockmanagement/warehouses/${warehouseId}/stock/storageLocations?itemsPerPage=250&page=${seite}`,
    );
    const eintraege = res?.entries ?? [];
    for (const e of eintraege) {
      const id = Number(e?.storageLocationId);
      if (ids.has(id) && Number(e?.quantity ?? 0) !== 0) belegt.add(id);
    }
    if (res?.isLastPage || eintraege.length === 0) break;
  }
  return belegt;
}

/**
 * Entfernt die falsch angelegten Zweige — oder zeigt im Probelauf nur, was
 * entfernt würde.
 */
export async function raeumeAuf(opts: AufraeumOptionen): Promise<AufraeumErgebnis> {
  const start = Date.now();
  const probelauf = opts.probelauf !== false;
  const maxLoeschungen = Math.max(0, Math.floor(opts.maxLoeschungen ?? 500));
  const budgetMs = Math.max(5_000, Math.floor(opts.budgetMs ?? 45_000));
  const diagnose: string[] = [];
  const meldungen: string[] = [];

  const leer = (fehlertext: string): AufraeumErgebnis => ({
    ok: false,
    probelauf,
    error: fehlertext,
    zweige: [],
    orteGesamt: 0,
    knotenGesamt: 0,
    orteGeloescht: 0,
    knotenGeloescht: 0,
    fehler: 0,
    offen: 0,
    schreiblimit: false,
    meldungen,
    diagnose,
    dauerMs: Date.now() - start,
  });

  let bestehende: Awaited<ReturnType<typeof ladeLagerorte>>;
  let struktur: Awaited<ReturnType<typeof ladeStruktur>>;
  try {
    [bestehende, struktur] = await Promise.all([
      ladeLagerorte(opts.warehouseId),
      ladeStruktur(opts.warehouseId),
    ]);
  } catch (err) {
    return leer(`Lager ${opts.warehouseId} nicht lesbar: ${(err as Error).message}`);
  }
  if (bestehende.abgebrochen || !struktur.vollstaendig) {
    return leer('Lagerorte oder Struktur waren nicht vollständig lesbar. Ohne vollständige Liste wird nichts gelöscht.');
  }

  const halle = [...struktur.dimensionen].sort((a, b) => a.tiefe - b.tiefe)[0];
  if (!halle?.kuerzel) {
    return leer('Die oberste Spalte des Lagers hat kein Kürzel — dann lässt sich nicht entscheiden, welcher Zweig falsch ist.');
  }

  let zweige = findeFalscheZweige(struktur.knoten, bestehende.orte, halle.id, halle.kuerzel);
  if (opts.nurWurzeln?.length) {
    const erlaubt = new Set(opts.nurWurzeln);
    zweige = zweige.filter((z) => erlaubt.has(z.wurzel.id));
  }

  diagnose.push(
    `${bestehende.orte.length} Lagerorte und ${struktur.knoten.length} Knoten gelesen. ` +
      `Oberste Knoten ohne Kürzel "${halle.kuerzel}": ${zweige.length}.`,
  );

  const alleOrte = zweige.flatMap((z) => z.orte);
  const alleKnoten = zweige.flatMap((z) => z.knoten);

  if (!alleOrte.length && !alleKnoten.length) {
    return {
      ...leer(''),
      ok: true,
      error: null,
      diagnose: [...diagnose, 'Nichts zu entfernen — es gibt keinen Zweig ohne Kürzel.'],
    };
  }

  // Sicherung: Nichts löschen, worauf Bestand liegt.
  let belegt: Set<number>;
  try {
    belegt = await mitBestand(opts.warehouseId, alleOrte);
  } catch (err) {
    return leer(`Bestand nicht prüfbar: ${(err as Error).message}. Ohne diese Prüfung wird nicht gelöscht.`);
  }
  if (belegt.size) {
    return leer(
      `Auf ${belegt.size} dieser Lagerorte liegt Bestand. Es wird nichts gelöscht — bitte erst umbuchen. ` +
        `Beispiel-IDs: ${[...belegt].slice(0, 10).join(', ')}`,
    );
  }
  diagnose.push(`Auf keinem der ${alleOrte.length} Lagerorte liegt Bestand.`);

  const uebersicht = zweige.map((z) => ({
    wurzelId: z.wurzel.id,
    name: z.wurzel.name,
    knoten: z.knoten.length,
    orte: z.orte.length,
    beispiele: z.orte.slice(0, 3).map((o) => o.name),
  }));

  const fertig = (
    orteGeloescht: number,
    knotenGeloescht: number,
    fehler: number,
    offen: number,
    schreiblimit: boolean,
  ): AufraeumErgebnis => ({
    ok: true,
    probelauf,
    error: null,
    zweige: uebersicht,
    orteGesamt: alleOrte.length,
    knotenGesamt: alleKnoten.length,
    orteGeloescht,
    knotenGeloescht,
    fehler,
    offen,
    schreiblimit,
    meldungen,
    diagnose,
    dauerMs: Date.now() - start,
  });

  if (probelauf) return fertig(0, 0, 0, alleOrte.length + alleKnoten.length, false);

  // --- Löschen: erst die Lagerorte, dann die Knoten von unten nach oben ----
  let orteGeloescht = 0;
  let knotenGeloescht = 0;
  let fehler = 0;
  let schreiblimit = false;
  let getan = 0;

  const abbruch = () => getan >= maxLoeschungen || Date.now() - start > budgetMs || schreiblimit;

  for (const o of alleOrte) {
    if (abbruch()) break;
    try {
      await loescheMitGeduld(`/rest/warehouses/locations/${o.id}`);
      orteGeloescht += 1;
    } catch (err) {
      fehler += 1;
      if (meldungen.length < 20) meldungen.push(`Lagerort ${o.id} (${o.name}): ${(err as Error).message.slice(0, 200)}`);
      if (istSchreiblimit(err)) schreiblimit = true;
    }
    getan += 1;
  }

  // Knoten nur anfassen, wenn alle Lagerorte des Zweigs weg sind — sonst
  // wehrt Plenty sich zu Recht.
  if (orteGeloescht === alleOrte.length && !schreiblimit) {
    // Tiefste zuerst: die Kette nach oben zählen.
    const tiefeVon = new Map<number, number>();
    const nachId = new Map(alleKnoten.map((k) => [k.id, k]));
    const tiefe = (k: Knoten): number => {
      if (tiefeVon.has(k.id)) return tiefeVon.get(k.id) as number;
      const eltern = nachId.get(k.parentId);
      const t = eltern ? tiefe(eltern) + 1 : 0;
      tiefeVon.set(k.id, t);
      return t;
    };
    const sortiert = [...alleKnoten].sort((a, b) => tiefe(b) - tiefe(a));

    for (const k of sortiert) {
      if (abbruch()) break;
      try {
        await loescheMitGeduld(`/rest/warehouses/locations/levels/${k.id}`);
        knotenGeloescht += 1;
      } catch (err) {
        fehler += 1;
        if (meldungen.length < 20) meldungen.push(`Knoten ${k.id} ("${k.name}"): ${(err as Error).message.slice(0, 200)}`);
        if (istSchreiblimit(err)) schreiblimit = true;
      }
      getan += 1;
    }
  }

  const offen = alleOrte.length - orteGeloescht + (alleKnoten.length - knotenGeloescht);
  if (schreiblimit) {
    diagnose.push('PlentyONE hat die Schreibbremse gezogen — nach einer Pause geht es weiter.');
  } else if (offen > 0) {
    diagnose.push(`${offen} Einträge bleiben offen (Obergrenze oder Zeitbudget) — einfach erneut starten.`);
  }

  return fertig(orteGeloescht, knotenGeloescht, fehler, offen, schreiblimit);
}
