/**
 * Etiketten: wie viele.
 *
 * Das Etikett selbst kommt aus Plenty (Vorlage, Größe, Inhalt). Hier steht nur
 * die Anzahl: ein Etikett je Stück, damit jedes Teil im Regal gescannt werden
 * kann.
 */

/** Obergrenze je Druckauftrag — gegen den Zahlendreher „1000 statt 10". */
export const MAX_ETIKETTEN = 200;

/** Ein Etikett je Stück, mindestens eins, gedeckelt. */
export function etikettAnzahl(bestand: number | null | undefined): number {
  const n = Number(bestand);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.round(n), MAX_ETIKETTEN);
}
