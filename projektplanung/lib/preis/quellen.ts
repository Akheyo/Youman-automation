/**
 * Welche Angebote zählen — und in welcher Reihenfolge.
 *
 * Der Wasserfall (Amanuel, September 2026):
 *
 *   1. eBay.de, deutsche Angebote          ← erste Wahl
 *   2. freies Netz, deutsche Angebote      ← wenn auf eBay nichts Deutsches da ist
 *   3. Nachbarländer, eBay oder Netz       ← immer das, was Deutschland am nächsten ist
 *   4. weiter weg                          ← Notnagel
 *
 * Gesucht wird nicht überall gleichzeitig: Sobald eine Stufe brauchbare
 * Angebote liefert, hören wir auf. Ein deutscher eBay-Preis ist mehr wert als
 * fünf polnische Shoppreise — er kommt aus demselben Markt, in derselben
 * Währung, mit derselben Steuer und denselben Käufern.
 */

import type { Angebot } from './regelwerk';

export type Plattform = 'ebay' | 'netz';

export interface MarktAngebot extends Angebot {
  /** Ländercode des Angebots, z. B. 'DE'. */
  land: string;
  plattform: Plattform;
  /**
   * Ursprungswährung, falls nicht Euro. Der Preis selbst ist IMMER in Euro
   * anzugeben — die Umrechnung passiert in der Recherche, nicht hier.
   */
  originalWaehrung?: string | null;
}

/**
 * Die direkten Nachbarn Deutschlands.
 *
 * ANNAHME: Innerhalb der Nachbarn kommen Österreich und die Schweiz zuerst.
 * Nicht wegen der Entfernung — alle neun grenzen an —, sondern weil dort
 * dieselbe Sprache gesprochen wird und derselbe Artikel deshalb mit denselben
 * Begriffen und in vergleichbaren Preislagen angeboten wird. Falls du das
 * anders siehst, ist es eine Zeile.
 */
export const NACHBARN_DEUTSCHSPRACHIG = ['AT', 'CH'];
export const NACHBARN_UEBRIGE = ['NL', 'BE', 'LU', 'FR', 'DK', 'PL', 'CZ'];
export const NACHBARLAENDER = [...NACHBARN_DEUTSCHSPRACHIG, ...NACHBARN_UEBRIGE];

/** Länder, deren Preise nicht in Euro stehen und umgerechnet werden müssen. */
export const NICHT_EURO = ['CH', 'PL', 'CZ', 'DK'];

export type Stufe = 'ebay_de' | 'netz_de' | 'nachbarn_dach' | 'nachbarn_uebrige' | 'weiter_weg';

export const STUFE_TEXT: Record<Stufe, string> = {
  ebay_de: 'eBay.de, deutsche Angebote',
  netz_de: 'freies Netz, deutsche Angebote',
  nachbarn_dach: 'Österreich und Schweiz',
  nachbarn_uebrige: 'übrige Nachbarländer',
  weiter_weg: 'weiter entfernte Märkte',
};

function land(a: MarktAngebot): string {
  return (a.land ?? '').trim().toUpperCase();
}

const STUFEN: Array<{ stufe: Stufe; passt: (a: MarktAngebot) => boolean }> = [
  { stufe: 'ebay_de', passt: (a) => land(a) === 'DE' && a.plattform === 'ebay' },
  { stufe: 'netz_de', passt: (a) => land(a) === 'DE' && a.plattform === 'netz' },
  { stufe: 'nachbarn_dach', passt: (a) => NACHBARN_DEUTSCHSPRACHIG.includes(land(a)) },
  { stufe: 'nachbarn_uebrige', passt: (a) => NACHBARN_UEBRIGE.includes(land(a)) },
  { stufe: 'weiter_weg', passt: (a) => !NACHBARLAENDER.includes(land(a)) && land(a) !== 'DE' },
];

export interface Quellenwahl {
  stufe: Stufe | null;
  angebote: MarktAngebot[];
  /** Was auf den übersprungenen Stufen zu holen gewesen wäre — für die Herleitung. */
  begruendung: string[];
  /** Angebote, deren Preis aus einer Fremdwährung stammt. */
  umgerechnet: MarktAngebot[];
}

/**
 * Wählt die beste Stufe, auf der es überhaupt Angebote gibt.
 *
 * Es wird NICHT gemischt: Deutsche eBay-Angebote und Schweizer Shoppreise in
 * einen Topf zu werfen erzeugt einen Durchschnitt, den es auf keinem Markt
 * gibt. Lieber drei Angebote aus einer Quelle als acht aus fünf.
 */
export function waehleQuellen(angebote: MarktAngebot[]): Quellenwahl {
  const begruendung: string[] = [];
  const brauchbar = angebote.filter((a) => Number.isFinite(a.preis) && a.preis > 0);

  for (const { stufe, passt } of STUFEN) {
    const treffer = brauchbar.filter(passt);
    if (treffer.length === 0) {
      begruendung.push(`${STUFE_TEXT[stufe]}: nichts gefunden.`);
      continue;
    }
    begruendung.push(`${STUFE_TEXT[stufe]}: ${treffer.length} Angebot(e) — diese Stufe wird verwendet.`);
    const umgerechnet = treffer.filter((a) => a.originalWaehrung && a.originalWaehrung.toUpperCase() !== 'EUR');
    if (umgerechnet.length > 0) {
      begruendung.push(
        `${umgerechnet.length} davon in Fremdwährung (${[...new Set(umgerechnet.map((a) => a.originalWaehrung))].join(', ')}) — ` +
          'umgerechnet; Wechselkurs und abweichende Mehrwertsteuer sind eine Fehlerquelle.',
      );
    }
    return { stufe, angebote: treffer, begruendung, umgerechnet };
  }

  begruendung.push('Auf keiner Stufe ein Angebot gefunden.');
  return { stufe: null, angebote: [], begruendung, umgerechnet: [] };
}

/**
 * Wie verlässlich ein Preis von dieser Stufe ist.
 *
 * Nicht zum Rechnen, sondern damit am Artikel steht, wie weit man für den
 * Preis gehen musste. Ein Preis aus Tschechien ist kein falscher Preis — aber
 * einer, den jemand noch einmal ansehen sollte.
 */
export function stufenGuete(stufe: Stufe | null): 'hoch' | 'mittel' | 'niedrig' {
  if (stufe === 'ebay_de') return 'hoch';
  if (stufe === 'netz_de' || stufe === 'nachbarn_dach') return 'mittel';
  return 'niedrig';
}
