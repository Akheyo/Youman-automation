/**
 * Laufweg ordnen — die Positionen der Struktur-Knoten neu durchnummerieren.
 *
 * PlentyONE berechnet den Kommissionier-Laufweg aus den Positionen der
 * Dimensions-Knoten (Halle, Regal, Ebene, Feld) — nicht aus der Position am
 * einzelnen Lagerort. Sichtbar ist das unter Waren » Lager » [Lager] »
 * Dimensionen: dort steht je Spalte "Position für Laufweg berücksichtigen".
 *
 * Der Fehler, der hier repariert wird: Neue Knoten werden mit "letzte
 * Position + 1" hinten angehängt statt einsortiert. In Burlo stand deshalb in
 * H1/R6/EA die Folge F16, F17, F18, F01, F02 … — der Mann läuft zu Fach 16,
 * dann zurück zu Fach 1.
 *
 * Geschrieben wird ausschliesslich das Feld `position`. Kein Bestand bewegt
 * sich, nichts wird gelöscht, und ein zweiter Lauf ändert nichts mehr.
 *
 * Endpunkte laut PlentyONE-REST-Doku:
 *   GET /rest/warehouses/{warehouseId}/locations/levels
 *   PUT /rest/warehouses/locations/levels/{id}
 */

import { plentyConfigured, plentyPut, aktuelleConfig } from './client';
import { HALLEN_REIHENFOLGE, REGAL_REIHENFOLGE, platzIn } from './laufweg-reihenfolge';
import { istSchreiblimit, ladeStruktur, schreibeMitGeduld, type Knoten } from './lagerort-anlegen';

/** Eine geplante oder erledigte Umnummerierung. */
export interface Aenderung {
  id: number;
  name: string;
  parentId: number;
  dimensionId: number;
  alt: number;
  neu: number;
}

/** Zwei Knoten, die dasselbe Fach in unterschiedlicher Schreibweise meinen. */
export interface Dublette {
  parentId: number;
  dimensionId: number;
  /** Vergleichsform, z. B. "F1" für F1 und F01. */
  schluessel: string;
  namen: string[];
  ids: number[];
}

export interface LaufwegErgebnis {
  ok: boolean;
  probelauf: boolean;
  error: string | null;
  /** Knoten insgesamt gelesen. */
  knoten: number;
  /** Gruppen (Elternknoten je Spalte), die geprüft wurden. */
  gruppen: number;
  aenderungen: Aenderung[];
  /** Wie viele davon geschrieben wurden. */
  geschrieben: number;
  fehler: number;
  offen: number;
  schreiblimit: boolean;
  dubletten: Dublette[];
  meldungen: string[];
  dauerMs: number;
}

/**
 * Zerlegt einen Knotennamen in Buchstaben-Vorsatz und Zahl.
 *
 * "F16" → { vorsatz: "F", zahl: 16 } · "EBZ" → { vorsatz: "EBZ" } ·
 * "HOF" → { vorsatz: "HOF" }. Namen ohne Zahl sortieren hinter die mit Zahl
 * desselben Vorsatzes — "HOF" landet also nach H1…H9, weil sein Vorsatz
 * alphabetisch hinter "H" liegt.
 */
export function zerlegeName(name: string): { vorsatz: string; zahl: number | null } {
  const roh = name.trim().toUpperCase();
  const treffer = /^([^0-9]*)(\d+)$/.exec(roh);
  if (!treffer) return { vorsatz: roh, zahl: null };
  return { vorsatz: treffer[1], zahl: Number(treffer[2]) };
}

/**
 * Vergleichsform eines Namens — führende Nullen weg. Damit fallen "F1" und
 * "F01" auf denselben Schlüssel; genau daran erkennt man die Dubletten.
 */
export function vergleichsname(name: string): string {
  const { vorsatz, zahl } = zerlegeName(name);
  return zahl === null ? vorsatz : `${vorsatz}${zahl}`;
}

/** Sortiert Knoten in natürlicher Reihenfolge: H1 < H2 < H10 < HOF. */
export function sortiereKnoten(a: Knoten, b: Knoten): number {
  const x = zerlegeName(a.name);
  const y = zerlegeName(b.name);
  if (x.vorsatz !== y.vorsatz) return x.vorsatz < y.vorsatz ? -1 : 1;
  if (x.zahl === null && y.zahl === null) return a.name.localeCompare(b.name);
  // Ohne Zahl hinter die mit Zahl — "F" wäre sonst vor "F01".
  if (x.zahl === null) return 1;
  if (y.zahl === null) return -1;
  if (x.zahl !== y.zahl) return x.zahl - y.zahl;
  // Gleiche Zahl, andere Schreibweise (F1 / F01): stabile Reihenfolge über die ID.
  return a.id - b.id;
}

/** Schlüssel der Geschwistergruppe: gleiche Eltern, gleiche Spalte. */
const gruppeVon = (k: Knoten) => `${k.parentId}|${k.dimensionId}`;

/**
 * Sortiert eine Geschwistergruppe nach dem echten Rundgang.
 *
 * Hallen und Regale stehen nicht in natürlicher Reihenfolge im Lager — H3
 * liegt am Tor, H1 in der Mitte. Wie gelaufen wird, steht in
 * `laufweg-reihenfolge.ts`, abgelesen vom Hallenplan. Was dort nicht steht,
 * kommt hinter die bekannten Knoten und wird untereinander natürlich
 * sortiert; so verschwindet nie etwas, es steht nur schlechter.
 *
 * Ebenen und Felder bleiben natürlich sortiert — die laufen aufsteigend.
 */
function sortiereGruppe(geschwister: Knoten[], nachId: Map<number, Knoten>): Knoten[] {
  const erste = geschwister[0];
  if (!erste) return [];

  // Oberste Ebene (kein Elternknoten): das sind die Hallen.
  const istHalle = erste.parentId === 0 || !nachId.has(erste.parentId);
  if (istHalle) {
    return [...geschwister].sort(
      (a, b) =>
        platzIn(HALLEN_REIHENFOLGE, a.name) - platzIn(HALLEN_REIHENFOLGE, b.name) ||
        sortiereKnoten(a, b),
    );
  }

  // Eine Ebene unter der Halle: die Regale. Welche Reihenfolge gilt, hängt
  // von der Halle ab, unter der sie hängen.
  const eltern = nachId.get(erste.parentId);
  const grosseltern = eltern ? nachId.get(eltern.parentId) : undefined;
  const istRegal = Boolean(eltern) && !grosseltern;
  if (istRegal && eltern) {
    const reihenfolge = REGAL_REIHENFOLGE[eltern.name.trim().toUpperCase()];
    if (reihenfolge) {
      return [...geschwister].sort(
        (a, b) => platzIn(reihenfolge, a.name) - platzIn(reihenfolge, b.name) || sortiereKnoten(a, b),
      );
    }
  }

  return [...geschwister].sort(sortiereKnoten);
}

/**
 * Rechnet aus, welche Knoten eine neue Position brauchen.
 *
 * Je Geschwistergruppe wird natürlich sortiert und dann 1…n durchnummeriert.
 * Zurück kommen nur die Knoten, deren Position sich dabei ändert — ein
 * zweiter Lauf liefert deshalb eine leere Liste.
 */
export function planeLaufweg(knoten: Knoten[]): { aenderungen: Aenderung[]; gruppen: number } {
  const gruppen = new Map<string, Knoten[]>();
  for (const k of knoten) {
    const g = gruppeVon(k);
    gruppen.set(g, [...(gruppen.get(g) ?? []), k]);
  }

  const nachId = new Map(knoten.map((k) => [k.id, k]));
  const aenderungen: Aenderung[] = [];
  for (const geschwister of gruppen.values()) {
    const sortiert = sortiereGruppe(geschwister, nachId);
    sortiert.forEach((k, i) => {
      const neu = i + 1;
      if (k.position !== neu) {
        aenderungen.push({
          id: k.id,
          name: k.name,
          parentId: k.parentId,
          dimensionId: k.dimensionId,
          alt: k.position,
          neu,
        });
      }
    });
  }
  return { aenderungen, gruppen: gruppen.size };
}

/**
 * Findet Knoten, die dasselbe meinen, aber anders geschrieben sind — "F1"
 * neben "F01" unter demselben Regal.
 *
 * Zusammengeführt wird hier nichts: Darunter hängen Lagerorte mit echtem
 * Bestand, und den umzuhängen ist eine Entscheidung, keine Aufräumarbeit.
 */
export function findeDubletten(knoten: Knoten[]): Dublette[] {
  const nachSchluessel = new Map<string, Knoten[]>();
  for (const k of knoten) {
    const s = `${gruppeVon(k)}|${vergleichsname(k.name)}`;
    nachSchluessel.set(s, [...(nachSchluessel.get(s) ?? []), k]);
  }

  const out: Dublette[] = [];
  for (const gruppe of nachSchluessel.values()) {
    if (gruppe.length < 2) continue;
    const erste = gruppe[0];
    out.push({
      parentId: erste.parentId,
      dimensionId: erste.dimensionId,
      schluessel: vergleichsname(erste.name),
      namen: gruppe.map((k) => k.name),
      ids: gruppe.map((k) => k.id),
    });
  }
  return out.sort((a, b) => b.namen.length - a.namen.length || a.schluessel.localeCompare(b.schluessel));
}

export interface LaufwegOptionen {
  warehouseId: number;
  /** Ohne ausdrückliches `probelauf: false` wird nichts geschrieben. */
  probelauf?: boolean;
  /** Zeitbudget je Aufruf; danach bricht der Lauf sauber ab. */
  budgetMs?: number;
  /** Obergrenze für Schreibzugriffe je Aufruf. */
  maxSchreiben?: number;
}

/**
 * Ordnet den Laufweg eines Lagers — liest die Struktur, rechnet die neuen
 * Positionen und schreibt sie (nur mit `probelauf: false`).
 */
export async function ordneLaufweg(opts: LaufwegOptionen): Promise<LaufwegErgebnis> {
  const start = Date.now();
  const probelauf = opts.probelauf !== false;
  const budgetMs = Math.max(5_000, Math.floor(opts.budgetMs ?? 45_000));
  const maxSchreiben = Math.max(1, Math.floor(opts.maxSchreiben ?? 2_000));
  const meldungen: string[] = [];

  const leer: LaufwegErgebnis = {
    ok: false, probelauf, error: null, knoten: 0, gruppen: 0,
    aenderungen: [], geschrieben: 0, fehler: 0, offen: 0,
    schreiblimit: false, dubletten: [], meldungen, dauerMs: 0,
  };

  if (!plentyConfigured(await aktuelleConfig())) {
    return { ...leer, error: 'PlentyONE ist nicht konfiguriert.', dauerMs: Date.now() - start };
  }

  let knoten: Knoten[];
  try {
    const struktur = await ladeStruktur(opts.warehouseId);
    // Eine unvollständige Struktur würde falsche Positionen erzeugen: Fehlt
    // ein Geschwisterknoten, verschiebt sich die ganze Gruppe.
    if (!struktur.vollstaendig) {
      return {
        ...leer,
        error: 'Die Struktur wurde nur teilweise gelesen — ohne vollständige Liste wird nicht umnummeriert.',
        dauerMs: Date.now() - start,
      };
    }
    knoten = struktur.knoten;
  } catch (err) {
    return { ...leer, error: `Struktur nicht lesbar: ${(err as Error).message}`, dauerMs: Date.now() - start };
  }

  const { aenderungen, gruppen } = planeLaufweg(knoten);
  const dubletten = findeDubletten(knoten);
  meldungen.push(`${knoten.length} Knoten in ${gruppen} Gruppen geprüft.`);
  meldungen.push(
    aenderungen.length
      ? `${aenderungen.length} Knoten stehen an der falschen Stelle im Laufweg.`
      : 'Alle Knoten stehen bereits in der richtigen Reihenfolge.',
  );
  if (dubletten.length) {
    meldungen.push(
      `${dubletten.length} Felder gibt es doppelt (verschiedene Schreibweisen) — die werden hier NICHT zusammengeführt.`,
    );
  }

  if (probelauf) {
    return { ...leer, ok: true, knoten: knoten.length, gruppen, aenderungen, dubletten, dauerMs: Date.now() - start };
  }

  let geschrieben = 0;
  let fehler = 0;
  let offen = 0;
  let schreiblimit = false;

  for (const a of aenderungen) {
    if (schreiblimit || geschrieben >= maxSchreiben || Date.now() - start > budgetMs) {
      offen += 1;
      continue;
    }
    try {
      await schreibeMitGeduld(() =>
        plentyPut(`/rest/warehouses/locations/levels/${a.id}`, {
          parentId: a.parentId,
          dimensionId: a.dimensionId,
          name: a.name,
          position: a.neu,
        }),
      );
      geschrieben += 1;
    } catch (err) {
      if (istSchreiblimit(err as Error)) {
        // Nicht als Fehler abhaken — die Zeile kommt im nächsten Aufruf dran.
        schreiblimit = true;
        offen += 1;
        continue;
      }
      fehler += 1;
      meldungen.push(`${a.name} (ID ${a.id}): ${(err as Error).message}`);
    }
  }

  return {
    ok: fehler === 0,
    probelauf: false,
    error: null,
    knoten: knoten.length,
    gruppen,
    aenderungen,
    geschrieben,
    fehler,
    offen,
    schreiblimit,
    dubletten,
    meldungen,
    dauerMs: Date.now() - start,
  };
}
