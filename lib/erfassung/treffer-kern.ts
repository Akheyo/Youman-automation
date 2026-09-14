/**
 * Reiner Kern der Trefferlogik — Suchbegriffe, Zuordnung, Beschriftung.
 *
 * BEWUSST OHNE SERVER-IMPORTE: Diese Datei wird auch im Browser gebraucht (die
 * Erfassungsseite zeigt die Treffer an). Läge sie zusammen mit dem
 * PlentyONE-Zugriff in einer Datei, zöge der Browser-Bundle den ganzen
 * Plenty-Client samt "node:crypto" mit — und der Build bricht ab.
 */

import type { Erkennung } from './erkennung';

export interface Treffer {
  /**
   * Die Artikel-ID — die Nummer, mit der in PlentyONE tatsächlich gearbeitet
   * wird. Sie steht vorn, weil sie die Auskunft ist, die jemand braucht: „Den
   * haben wir schon, Artikel 65932."
   */
  itemId: number | null;
  /**
   * Die Variante gehört zur Vollständigkeit dazu, wird aber nicht angezeigt.
   * Am Regal sagt eine Variantennummer niemandem etwas, und ein Artikel mit
   * mehreren Varianten erschiene sonst mehrfach in der Liste.
   */
  variationId: number | null;
  name: string | null;
  nummer: string | null;
  /** Womit dieser Treffer gefunden wurde — ohne das ist eine Trefferliste nicht prüfbar. */
  gefundenMit: string;
}

export interface TrefferErgebnis {
  treffer: Treffer[];
  diagnose: string[];
}

export interface PlentyVariante {
  id?: number | string;
  itemId?: number | string;
  number?: string;
  name?: string;
  item?: { id?: number | string };
}

export function zahl(wert: unknown): number | null {
  const n = typeof wert === 'string' ? Number(wert) : typeof wert === 'number' ? wert : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Die Suchbegriffe in sinnvoller Reihenfolge.
 *
 * Zu kurze oder zu allgemeine Begriffe werden aussortiert: „Kabel" träfe das
 * halbe Lager und wäre als Treffer wertlos.
 */
export function suchbegriffeOrdnen(erkennung: Pick<Erkennung, 'modellnummer' | 'hersteller' | 'modell' | 'titel' | 'suchbegriffe'>): string[] {
  const kandidaten = [
    erkennung.modellnummer,
    [erkennung.hersteller, erkennung.modell].filter(Boolean).join(' '),
    erkennung.titel,
    ...erkennung.suchbegriffe,
  ];

  const gesehen = new Set<string>();
  const raus: string[] = [];
  for (const roh of kandidaten) {
    const begriff = (roh ?? '').replace(/\s+/g, ' ').trim();
    if (begriff.length < 4) continue;
    // Ein einzelnes allgemeines Wort taugt nicht — außer es ist eine
    // Modellnummer, die sich an Ziffern erkennen lässt.
    const einWort = !begriff.includes(' ');
    if (einWort && !/\d/.test(begriff) && begriff.length < 8) continue;
    const schluessel = begriff.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    raus.push(begriff);
  }
  return raus.slice(0, 4);
}

/**
 * Nach welchem Merkmal ein Treffer eindeutig ist.
 *
 * Zusammengefasst wird über die ARTIKEL-ID, nicht über die Variante: Ein
 * Artikel mit drei Varianten ist ein Treffer, nicht drei. Fehlt die Artikel-ID
 * ausnahmsweise, bleibt die Variante als Notbehelf — aber nur zum
 * Auseinanderhalten, angezeigt wird sie nicht.
 */
export function trefferSchluessel(treffer: Treffer): string {
  if (treffer.itemId) return `i${treffer.itemId}`;
  if (treffer.variationId) return `v${treffer.variationId}`;
  return `n${treffer.nummer ?? treffer.name ?? Math.random()}`;
}

/** Wandelt Plenty-Varianten in Treffer um. Rein, damit testbar. */
export function alsTreffer(eintraege: PlentyVariante[], begriff: string): Treffer[] {
  return eintraege.map((eintrag) => ({
    itemId: zahl(eintrag?.itemId) ?? zahl(eintrag?.item?.id),
    variationId: zahl(eintrag?.id),
    name: eintrag?.name ?? null,
    nummer: eintrag?.number ?? null,
    gefundenMit: begriff,
  }));
}

/**
 * Wie ein Treffer benannt wird.
 *
 * Die Artikel-ID zuerst — das ist die Nummer, die in PlentyONE eingetippt wird.
 * Ohne sie wäre die Angabe wertlos, deshalb wird das dann auch gesagt, statt
 * ersatzweise eine Variantennummer zu zeigen, die jemand für eine Artikel-ID
 * halten könnte.
 */
export function trefferText(treffer: Treffer): string {
  const bezeichnung = treffer.name ?? treffer.nummer ?? null;
  if (!treffer.itemId) return bezeichnung ? `${bezeichnung} (ohne Artikel-ID)` : 'Treffer ohne Artikel-ID';
  return bezeichnung ? `Artikel ${treffer.itemId} — ${bezeichnung}` : `Artikel ${treffer.itemId}`;
}

