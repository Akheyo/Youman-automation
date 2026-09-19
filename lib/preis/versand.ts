/**
 * Unsere Versandkosten.
 *
 * Sie sind kein Beiwerk, sondern gehen direkt in den Verkaufspreis ein: eBay
 * sortiert nach Preis PLUS Versand, also muss unser Versand vom Ziel abgezogen
 * werden (siehe regelwerk.ts → preisBestimmen). Eine falsche Staffel hier
 * verschiebt jeden Preis.
 *
 * Auf eBay und im Webshop gelten dieselben Sätze (Amanuel, September 2026).
 */

/** Wie aufwendig der Artikel zu verpacken ist. Zählt erst über 10 kg. */
export type Packklasse = 'normal' | 'sperrig' | 'schwierig';

export const PACKKLASSE_TEXT: Record<Packklasse, string> = {
  normal: 'normal verpackbar',
  sperrig: 'sperrig',
  schwierig: 'sperrig und schwer zu verpacken',
};

/**
 * Die Staffel nach Gewicht.
 *
 * Bis 10 kg gibt es einen festen Satz. Darüber entscheidet zusätzlich, wie
 * sperrig der Artikel ist und wie leicht er sich verpacken lässt — dieselben
 * 25 kg sind als kompakter Motor etwas anderes als als Gehäuse.
 */
export const VERSANDSTAFFEL: Array<{ bisKg: number; preise: Record<Packklasse, number> }> = [
  { bisKg: 5, preise: { normal: 7.9, sperrig: 7.9, schwierig: 7.9 } },
  { bisKg: 10, preise: { normal: 9.9, sperrig: 9.9, schwierig: 9.9 } },
  { bisKg: 30, preise: { normal: 14.9, sperrig: 19.9, schwierig: 29.9 } },
];

/** Ab hier geht nichts mehr als Paket. */
export const PAKET_GRENZE_KG = 30;

export interface Versandbefund {
  /** Kosten in Euro, oder null wenn kein Paketversand möglich ist. */
  kosten: number | null;
  /** Nur per Spedition oder Abholung zu versenden. */
  spedition: boolean;
  begruendung: string;
}

/**
 * Ermittelt die Versandkosten aus Gewicht und Packklasse.
 *
 * Ohne Gewicht wird NICHT geschätzt. Die Bilderkennung liest ein Gewicht nur,
 * wenn es irgendwo aufgedruckt ist; ein geratenes Gewicht führt über die
 * Preisformel direkt zu einem falschen Verkaufspreis. Lieber eine Lücke, die
 * jemand füllt.
 */
export function versandkosten(
  gewichtKg: number | null | undefined,
  packklasse: Packklasse = 'normal',
): Versandbefund {
  if (gewichtKg == null || !Number.isFinite(gewichtKg) || gewichtKg <= 0) {
    return {
      kosten: null,
      spedition: false,
      begruendung: 'Gewicht unbekannt — ohne das lässt sich der Versand nicht bestimmen und der Preis nicht rechnen.',
    };
  }

  if (gewichtKg > PAKET_GRENZE_KG) {
    return {
      kosten: null,
      spedition: true,
      begruendung: `${gewichtKg} kg — über ${PAKET_GRENZE_KG} kg geht nur Spedition oder Abholung.`,
    };
  }

  const stufe = VERSANDSTAFFEL.find((s) => gewichtKg <= s.bisKg)!;
  const kosten = stufe.preise[packklasse];
  const zusatz = stufe.bisKg > 10 ? `, ${PACKKLASSE_TEXT[packklasse]}` : '';
  return {
    kosten,
    spedition: false,
    begruendung: `${gewichtKg} kg (bis ${stufe.bisKg} kg${zusatz}) → ${kosten.toFixed(2)} €.`,
  };
}
