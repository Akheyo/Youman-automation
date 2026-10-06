/**
 * Etiketten: Größe und Anzahl.
 *
 * Die Größe hängt am Drucker des Arbeitsplatzes, nicht am Artikel — sie wird
 * deshalb je Gerät gemerkt. Die Anzahl folgt dem Bestand: ein Etikett je
 * Stück, damit jedes Teil im Regal gescannt werden kann.
 */

export interface Etikettformat {
  id: string;
  name: string;
  breiteMm: number;
  hoeheMm: number;
}

export const ETIKETTFORMATE: Etikettformat[] = [
  { id: '57x32', name: '57 × 32 mm', breiteMm: 57, hoeheMm: 32 },
  { id: '50x25', name: '50 × 25 mm', breiteMm: 50, hoeheMm: 25 },
  { id: '62x29', name: '62 × 29 mm (Brother)', breiteMm: 62, hoeheMm: 29 },
  { id: '54x25', name: '54 × 25 mm (Dymo)', breiteMm: 54, hoeheMm: 25 },
  { id: '100x50', name: '100 × 50 mm', breiteMm: 100, hoeheMm: 50 },
];

export const STANDARD_FORMAT = ETIKETTFORMATE[0];

export function formatNachId(id: string | null | undefined): Etikettformat {
  return ETIKETTFORMATE.find((f) => f.id === id) ?? STANDARD_FORMAT;
}

/** Obergrenze je Druckauftrag — gegen den Zahlendreher „1000 statt 10". */
export const MAX_ETIKETTEN = 200;

/** Ein Etikett je Stück, mindestens eins, gedeckelt. */
export function etikettAnzahl(bestand: number | null | undefined): number {
  const n = Number(bestand);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.round(n), MAX_ETIKETTEN);
}
