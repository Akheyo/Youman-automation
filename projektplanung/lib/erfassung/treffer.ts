/**
 * „Haben wir das schon mal gehabt?"
 *
 * Nach der Erkennung wird in PlentyONE nach demselben Teil gesucht. Bei
 * Gebrauchtware ist das zweimal wertvoll: Ein früheres Exemplar hat einen
 * fertigen Text und — vor allem — einen Preis, zu dem es tatsächlich verkauft
 * wurde. Das ist die beste Preisquelle, die es gibt, und sie gehört euch.
 *
 * Gesucht wird mit den Begriffen aus der Erkennung, die stärksten zuerst:
 * Modellnummer schlägt Hersteller+Modell schlägt Titel.
 */

import { plentyEingerichtet, plentyGet } from '@/lib/plenty/client';
import type { Erkennung } from './erkennung';

export interface Treffer {
  variationId: number | null;
  itemId: number | null;
  name: string | null;
  nummer: string | null;
  /** Womit dieser Treffer gefunden wurde — ohne das ist eine Trefferliste nicht prüfbar. */
  gefundenMit: string;
}

export interface TrefferErgebnis {
  treffer: Treffer[];
  diagnose: string[];
}

interface PlentyListe<T> {
  entries?: T[];
}
interface PlentyVariante {
  id?: number | string;
  itemId?: number | string;
  number?: string;
  name?: string;
  item?: { id?: number | string };
}

function zahl(wert: unknown): number | null {
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

const MAX_TREFFER = 8;

/**
 * Fragt PlentyONE mit den bekannten Namensfiltern ab.
 *
 * Welcher Filter funktioniert, hängt von der Plenty-Ausbaustufe ab — deshalb
 * werden sie der Reihe nach probiert statt geraten. Liefert ein Filter die
 * volle Seite zurück, hat er vermutlich gar nicht gefiltert; solche Antworten
 * werden verworfen, statt eine Zufallsliste als Treffer auszugeben.
 */
async function frage(begriff: string): Promise<PlentyVariante[] | null> {
  const q = encodeURIComponent(begriff);
  const pfade = [
    `/rest/items/variations?numberExact=${q}&itemsPerPage=${MAX_TREFFER}&with=item`,
    `/rest/items/variations?name=${q}&itemsPerPage=${MAX_TREFFER}&with=item`,
    `/rest/items/variations?itemName=${q}&itemsPerPage=${MAX_TREFFER}&with=item`,
  ];
  for (const pfad of pfade) {
    try {
      const res = await plentyGet<PlentyListe<PlentyVariante>>(pfad);
      const eintraege = res?.entries ?? [];
      if (eintraege.length > 0 && eintraege.length < MAX_TREFFER) return eintraege;
    } catch {
      // Nächsten Filter probieren.
    }
  }
  return null;
}

export async function sucheAehnliche(
  erkennung: Pick<Erkennung, 'modellnummer' | 'hersteller' | 'modell' | 'titel' | 'suchbegriffe'>,
): Promise<TrefferErgebnis> {
  const diagnose: string[] = [];

  if (!(await plentyEingerichtet())) {
    diagnose.push('PlentyONE ist nicht eingerichtet — es wurde nicht nach vorhandenen Artikeln gesucht.');
    return { treffer: [], diagnose };
  }

  const begriffe = suchbegriffeOrdnen(erkennung);
  if (begriffe.length === 0) {
    diagnose.push('Kein Suchbegriff war eindeutig genug — ohne Modellnummer oder Marke wäre jeder Treffer Zufall.');
    return { treffer: [], diagnose };
  }

  const treffer: Treffer[] = [];
  const gesehen = new Set<number>();

  for (const begriff of begriffe) {
    const eintraege = await frage(begriff);
    if (!eintraege) {
      diagnose.push(`Keine Treffer für „${begriff}".`);
      continue;
    }
    for (const eintrag of eintraege) {
      const variationId = zahl(eintrag?.id);
      if (variationId && gesehen.has(variationId)) continue;
      if (variationId) gesehen.add(variationId);
      treffer.push({
        variationId,
        itemId: zahl(eintrag?.itemId) ?? zahl(eintrag?.item?.id),
        name: eintrag?.name ?? null,
        nummer: eintrag?.number ?? null,
        gefundenMit: begriff,
      });
    }
    diagnose.push(`„${begriff}": ${eintraege.length} Treffer.`);
    // Ein guter Begriff reicht. Weitersuchen verwässert die Liste nur.
    if (treffer.length >= 3) break;
  }

  return { treffer: treffer.slice(0, MAX_TREFFER), diagnose };
}
