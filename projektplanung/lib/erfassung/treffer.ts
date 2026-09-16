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
import {
  alsTreffer,
  suchbegriffeOrdnen,
  trefferSchluessel,
  type PlentyVariante,
  type Treffer,
  type TrefferErgebnis,
} from './treffer-kern';

export * from './treffer-kern';

interface PlentyListe<T> {
  entries?: T[];
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
  const gesehen = new Set<string>();

  for (const begriff of begriffe) {
    const eintraege = await frage(begriff);
    if (!eintraege) {
      diagnose.push(`Keine Treffer für „${begriff}".`);
      continue;
    }
    for (const neuerTreffer of alsTreffer(eintraege, begriff)) {
      const schluessel = trefferSchluessel(neuerTreffer);
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      treffer.push(neuerTreffer);
    }
    diagnose.push(`„${begriff}": ${eintraege.length} Treffer.`);
    // Ein guter Begriff reicht. Weitersuchen verwässert die Liste nur.
    if (treffer.length >= 3) break;
  }

  return { treffer: treffer.slice(0, MAX_TREFFER), diagnose };
}
