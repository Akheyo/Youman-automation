/**
 * Lagerplatz-Erkennung — reine Logik, kein Netzwerk.
 *
 * Viele Artikel tragen ihren Lagerplatz nur im Text: in der Variantennummer
 * ("…H6R5A7"), im Modell-/Externe-ID-Feld oder mitten in der Artikel-
 * beschreibung ("Lagerplatz: Halle 6 Regal 5 Ablage 7").
 *
 * Dieses Modul findet solche Muster tolerant wieder und bringt sie auf eine
 * einheitliche Form:
 *
 *   "H6R5A7"  ·  "h6-r5-a7"  ·  "H 06 R 05 A 07"  ·  "Halle 6 Regal 5 Ablage 7"
 *        →  Code "H6R5A7"  ·  Klartext "Halle 6 · Regal 5 · Ablage 7"
 *
 * Bewusst NICHT alles wird als Lagerplatz durchgewinkt: Maßangaben wie
 * "L120B60H90" sehen genauso aus und werden als "ignoriert" markiert statt
 * still mitgezählt. Alles Unklare landet als "unsicher" in der Vorschau — die
 * Entscheidung trifft der Mensch, nicht der Parser.
 */

/** Wie verlässlich ist ein Treffer? */
export type Sicherheit = 'sicher' | 'unsicher' | 'ignoriert';

/** Ein einzelnes Segment des Codes, z. B. { schluessel: 'R', nummer: 5 }. */
export interface Segment {
  schluessel: string;
  nummer: number;
}

/** Ein erkannter Lagerplatz-Code. */
export interface LagerplatzTreffer {
  /** Normierte Schreibweise, z. B. "H6R5A7". */
  code: string;
  /** So stand es im Text (zum Nachvollziehen in der Vorschau). */
  roh: string;
  segmente: Segment[];
  sicherheit: Sicherheit;
  /** Warum unsicher/ignoriert — null bei "sicher". */
  grund: string | null;
  /** Lesbare Form, z. B. "Halle 6 · Regal 5 · Ablage 7". */
  klartext: string;
}

// ---------------------------------------------------------------------------
// Vokabular
// ---------------------------------------------------------------------------

/** Bekannte Ebenen-Kürzel und ihr Klartext. */
const SCHLUESSEL: Record<string, string> = {
  H: 'Halle',
  L: 'Lager',
  G: 'Gang',
  Z: 'Zeile',
  R: 'Regal',
  E: 'Ebene',
  F: 'Fach',
  A: 'Ablage',
  B: 'Boden',
  P: 'Platz',
  C: 'Container',
  K: 'Kiste',
  S: 'Stellplatz',
};

/**
 * Kürzel, die genauso gut eine Maßangabe sein können
 * (Länge, Breite, Höhe, Tiefe, Durchmesser, Weite).
 */
const MASS_SCHLUESSEL = new Set(['L', 'B', 'H', 'T', 'D', 'W']);

/**
 * Wörter, die vor dem Code stehen und ihn nur ankündigen. Sie werden entfernt,
 * damit aus "Lagerplatz: H6R5A7" nicht versehentlich ein "P"-Segment wird.
 */
const ETIKETTEN = [
  'LAGERPLAETZE',
  'LAGERPLATZ',
  'LAGERORT',
  'STELLPLATZ',
  'STANDORT',
  'LAGERFACH',
];

/**
 * Ausgeschriebene Ebenen → Kürzel. Reihenfolge zählt: längere Wörter zuerst,
 * sonst frisst "LAGER" den Anfang von "LAGERPLATZ".
 */
const WORTE: Array<[string, string]> = [
  ['LAGERHALLE', 'H'],
  ['HALLE', 'H'],
  ['CONTAINER', 'C'],
  ['STELLAGE', 'R'],
  ['REGAL', 'R'],
  ['REIHE', 'R'],
  ['ABLAGE', 'A'],
  ['ABTEIL', 'A'],
  ['EBENE', 'E'],
  ['BODEN', 'B'],
  ['FACH', 'F'],
  ['GANG', 'G'],
  ['ZEILE', 'Z'],
  ['KISTE', 'K'],
  ['PLATZ', 'P'],
  ['LAGER', 'L'],
];

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

/** HTML raus, Großschreibung rein, Umlaute auflösen. */
export function normalisiere(text: string): string {
  return (text ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS');
}

/** Etiketten entfernen und ausgeschriebene Ebenen auf ihr Kürzel bringen. */
function vereinheitliche(text: string): string {
  let out = normalisiere(text);
  for (const wort of ETIKETTEN) {
    out = out.replace(new RegExp(`\\b${wort}\\b`, 'g'), ' ');
  }
  for (const [wort, kuerzel] of WORTE) {
    // Nur ersetzen, wenn direkt danach eine Zahl folgt ("Regal 5"), damit
    // Fließtext wie "im Lager gefunden" keine Segmente erzeugt.
    out = out.replace(new RegExp(`\\b${wort}\\b(?=[\\s.:_/-]*\\d)`, 'g'), ` ${kuerzel} `);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Erkennung
// ---------------------------------------------------------------------------

/**
 * Ein Lauf aus 2–5 Gruppen "Buchstabe + Zahl", optional getrennt durch
 * Leerzeichen, Bindestrich, Punkt, Schrägstrich oder Unterstrich.
 */
const MUSTER = /(?<![A-Z0-9])((?:[A-Z][\s._/-]{0,2}\d{1,3}[\s._/-]{0,2}){2,5})(?![A-Z0-9])/g;

/** Zerlegt einen Rohtreffer in seine Segmente. */
function zerlege(roh: string): Segment[] {
  const segmente: Segment[] = [];
  for (const m of roh.matchAll(/([A-Z])[\s._/-]{0,2}(\d{1,3})/g)) {
    segmente.push({ schluessel: m[1], nummer: Number(m[2]) });
  }
  return segmente;
}

/** Normierte Schreibweise: Kürzel + Zahl ohne führende Nullen. */
export function codeAus(segmente: Segment[]): string {
  return segmente.map((s) => `${s.schluessel}${s.nummer}`).join('');
}

/** Lesbare Form für die Oberfläche. */
export function klartextAus(segmente: Segment[]): string {
  return segmente.map((s) => `${SCHLUESSEL[s.schluessel] ?? s.schluessel} ${s.nummer}`).join(' · ');
}

/** Entscheidet, wie verlässlich ein Treffer ist. */
function bewerte(segmente: Segment[]): { sicherheit: Sicherheit; grund: string | null } {
  const schluessel = segmente.map((s) => s.schluessel);
  const unbekannt = schluessel.filter((k) => !(k in SCHLUESSEL));
  const doppelt = schluessel.length !== new Set(schluessel).size;

  // Maßangabe? "L120B60H90" sieht aus wie ein Lagerplatz, ist aber ein Karton.
  const nurMass = schluessel.every((k) => MASS_SCHLUESSEL.has(k));
  const grosseZahlen = segmente.filter((s) => s.nummer >= 10).length;
  if (nurMass && grosseZahlen >= 2) {
    return { sicherheit: 'ignoriert', grund: 'sieht nach Maßangabe aus (Länge/Breite/Höhe)' };
  }

  if (segmente.length < 3) {
    return { sicherheit: 'unsicher', grund: 'nur zwei Ebenen erkannt' };
  }
  if (unbekannt.length) {
    return { sicherheit: 'unsicher', grund: `unbekannte Ebene „${unbekannt.join(', ')}“` };
  }
  if (doppelt) {
    return { sicherheit: 'unsicher', grund: 'dieselbe Ebene kommt mehrfach vor' };
  }
  return { sicherheit: 'sicher', grund: null };
}

/**
 * Findet alle Lagerplatz-Muster in einem Text.
 * Doppelte Codes werden zusammengefasst, der erste Fundort bleibt erhalten.
 */
export function findeLagerplaetze(text: string): LagerplatzTreffer[] {
  if (!text || !text.trim()) return [];
  const vorbereitet = vereinheitliche(text);
  const gefunden = new Map<string, LagerplatzTreffer>();

  for (const m of vorbereitet.matchAll(MUSTER)) {
    const segmente = zerlege(m[1]);
    if (segmente.length < 2) continue;
    const code = codeAus(segmente);
    if (gefunden.has(code)) continue;
    const { sicherheit, grund } = bewerte(segmente);
    gefunden.set(code, {
      code,
      roh: m[1].trim().replace(/\s+/g, ' '),
      segmente,
      sicherheit,
      grund,
      klartext: klartextAus(segmente),
    });
  }

  return [...gefunden.values()];
}

/**
 * Wählt den aussagekräftigsten Treffer eines Textes:
 * „sicher" schlägt „unsicher", mehr Ebenen schlagen weniger.
 * Ignorierte Treffer (Maßangaben) kommen nie zurück.
 */
export function besterTreffer(treffer: LagerplatzTreffer[]): LagerplatzTreffer | null {
  const rang = (t: LagerplatzTreffer) => (t.sicherheit === 'sicher' ? 2 : 1);
  const brauchbar = treffer.filter((t) => t.sicherheit !== 'ignoriert');
  if (!brauchbar.length) return null;
  return brauchbar.reduce((a, b) => {
    if (rang(b) !== rang(a)) return rang(b) > rang(a) ? b : a;
    return b.segmente.length > a.segmente.length ? b : a;
  });
}
