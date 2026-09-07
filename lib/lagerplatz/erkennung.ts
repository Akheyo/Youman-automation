/**
 * Lagerplatz-Erkennung für das Schema der Komplett Konzept Verwertung.
 *
 * Zwei Schreibweisen kommen in den Daten vor:
 *
 *   LANG  – so stehen die echten Lagerorte in Plenty:
 *           "H2/R7/EA F08-K71"   ·   "H6/R2KTL/ED F01-0"   ·   "H5/RKTL/EA F01-K071"
 *           Halle / Regal / Ebene, Fach, Kiste ("-0" = keine Kiste)
 *
 *   KURZ  – so steht es im Fließtext, in Variantennummern und Kommentaren:
 *           "H1R6A10"  ·  "H2R7A15K30"  ·  "h1r6a10"  ·  "H1R5A12K2+3"
 *           Halle, Regal, Ebene (ein Buchstabe), Fach, optional Kiste
 *
 * Beide werden auf die LANGE Form normiert, weil das die Form ist, mit der
 * Plenty arbeitet. So lassen sich Text und echter Lagerort direkt vergleichen.
 *
 * Die Regeln stammen aus einer Stichprobe von 1.000 Artikeln mit Bestand
 * (711 echte Lagerorte) — nicht aus Annahmen.
 */

/** Wie verlässlich ist ein Treffer? */
export type Sicherheit = 'sicher' | 'unsicher' | 'ignoriert';

/** Ein Lagerplatz in seine Bestandteile zerlegt. */
export interface Segment {
  halle: number;
  /** Regal — kann Buchstaben enthalten, z. B. "8KTL" oder "KTL". */
  regal: string;
  /** Ebene ohne das führende E, z. B. "A", "BZ". */
  ebene: string;
  /** Fach — meist eine Zahl, vereinzelt mit Buchstaben ("M1"). */
  fach: string;
  /**
   * Zusatz hinter dem Bindestrich, normiert:
   *   "K71" = Kiste 71
   *   "0"   = weder Kiste noch Unterfach
   *   "1"   = Unterfach 1 (ein Fach kann mehrere Unterfächer haben)
   *   "P16" = Palettenplatz
   * Führende Nullen werden entfernt, damit "-01" und "-1" als derselbe Platz
   * gezählt werden — in Plenty kommen beide Schreibweisen vor.
   * null = im Text gar nicht angegeben.
   */
  kiste: string | null;
}

/** Ein erkannter Lagerplatz. */
export interface LagerplatzTreffer {
  /** Normiert auf die Plenty-Form, z. B. "H2/R7/EA F08-K71". */
  code: string;
  /** So stand es im Text. */
  roh: string;
  segment: Segment;
  /** Die Schreibweise, in der es gefunden wurde. */
  form: 'lang' | 'kurz';
  sicherheit: Sicherheit;
  grund: string | null;
  /** Lesbar, z. B. "Halle 2 · Regal 7 · Ebene A · Fach 8 · Kiste 71". */
  klartext: string;
}

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

/** HTML raus, Großschreibung rein, Umlaute auflösen. */
export function normalisiere(text: string): string {
  return (text ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS');
}

/** Ausgeschriebene Ebenen auf ihr Kürzel bringen ("Halle 2 Regal 7" → "H2 R7"). */
function vereinheitliche(text: string): string {
  let out = normalisiere(text);
  // Kleinteillager: "H1KTLA67" meint Halle 1, Regal KTL, Ebene A, Fach 67 —
  // das "R" fehlt dort. Einmal ergaenzen, dann greift die normale Regel.
  out = out.replace(/\bH\s*(\d{1,2})\s*(\d{0,2}KTL)/g, 'H$1R$2');

  for (const [wort, kuerzel] of [
    ['LAGERPLATZ', ' '],
    ['LAGERORT', ' '],
    ['STANDORT', ' '],
    ['LAGERHALLE', 'H'],
    ['HALLE', 'H'],
    ['REGAL', 'R'],
    // "Ebene"/"Fach"/"Kiste" werden bewusst NICHT ersetzt: In der Kurzform
    // steht der Buchstabe für die EBENE, ein eingesetztes "F" für "Fach"
    // würde daraus eine Ebene F machen und einen falschen Platz erzeugen.
  ] as Array<[string, string]>) {
    out = out.replace(new RegExp(`\\b${wort}\\b`, 'g'), kuerzel === ' ' ? ' ' : ` ${kuerzel}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Die lange Form, wie Plenty sie führt. */
const LANG =
  /(?<![A-Z0-9])H\s*(\d{1,2})\s*\/\s*R\s*(\d{1,2}KTL|KTL|\d{1,2})\s*\/\s*E([A-Z]{1,2})\s*F\s*([A-Z]?\d{1,3})\s*-\s*(?:K\s*(\d{1,3})|([A-Z]?\d{1,3}))/g;

/**
 * Die kurze Form aus Nummern und Fließtext.
 *
 * BEWUSST OHNE Grenze vor dem "H": In den Beschreibungen ist der Lagerplatz
 * beim Formatieren oft an den vorherigen Text gerutscht und klebt ohne
 * Trennzeichen dahinter — "…ebay.de/str/derprofi24H1R7F7K8-7_CK". Mit einer
 * Wortgrenze blieben rund die Hälfte aller Hinweise unentdeckt. Die Struktur
 * (Halle + Regal + Ebene A–J + Fach) ist eigen genug, um auch ohne Grenze
 * zu tragen.
 */
const KURZ =
  /H\s*(\d{1,2})\s*[-_/.]?\s*R\s*(\d{1,2}KTL|KTL|\d{1,2})\s*[-_/.]?\s*([A-J])\s*(\d{1,2})(?:\s*[-_]?\s*K\s*(\d{1,3})((?:\s*\+\s*\d{1,3})*))?(?![0-9])/g;

/**
 * Bringt den Zusatz auf eine einheitliche Form: Kisten zweistellig ("K7" →
 * "K07"), Unterfächer ohne führende Nullen ("01" → "1"). Sonst bliebe
 * derselbe Platz je nach Schreibweise doppelt gezählt.
 */
function normZusatz(roh: string): string {
  const kiste = roh.match(/^K0*(\d+)$/);
  if (kiste) return `K${kiste[1].padStart(2, '0')}`;
  const zahl = roh.match(/^0*(\d+)$/);
  if (zahl) return zahl[1];
  return roh;
}

/** Erlaubte Ebenen-Buchstaben laut Bestand (A–J, optional mit Z-Zusatz). */
const EBENEN = /^[A-J]Z?$/;

/** Baut die normierte Plenty-Schreibweise. */
export function codeAus(s: Segment): string {
  // Reine Zahlen zweistellig ("F08"), alles andere unverändert ("FM1").
  const fach = /^\d+$/.test(s.fach) ? s.fach.padStart(2, '0') : s.fach;
  const kiste = s.kiste ?? '0';
  return `H${s.halle}/R${s.regal}/E${s.ebene} F${fach}-${kiste}`;
}

/** Lesbare Form für die Oberfläche. */
export function klartextAus(s: Segment): string {
  const teile = [`Halle ${s.halle}`, `Regal ${s.regal}`, `Ebene ${s.ebene}`, `Fach ${/^\d+$/.test(s.fach) ? Number(s.fach) : s.fach}`];
  if (s.kiste && s.kiste !== '0') {
    if (s.kiste.startsWith('K')) teile.push(`Kiste ${Number(s.kiste.slice(1))}`);
    else if (s.kiste.startsWith('P')) teile.push(`Palettenplatz ${s.kiste.slice(1)}`);
    else teile.push(`Unterfach ${s.kiste}`);
  }
  return teile.join(' · ');
}

/**
 * Vergleicht zwei Lagerplätze bis auf die Kiste. Ein Texthinweis ohne Kiste
 * ("H1R6A10") meint denselben Ort wie "H1/R6/EA F10-K07" — nur ungenauer.
 */
export function gleicherOrt(a: string, b: string): boolean {
  const ohneKiste = (s: string) => s.replace(/-(?:K\d+|0)$/, '');
  return ohneKiste(a) === ohneKiste(b);
}

// ---------------------------------------------------------------------------
// Erkennung
// ---------------------------------------------------------------------------

function bewerte(s: Segment, form: 'lang' | 'kurz'): { sicherheit: Sicherheit; grund: string | null } {
  if (!EBENEN.test(s.ebene)) {
    return { sicherheit: 'unsicher', grund: `unübliche Ebene „E${s.ebene}"` };
  }
  if (s.halle < 1 || s.halle > 9) {
    return { sicherheit: 'unsicher', grund: `Halle ${s.halle} gibt es nicht` };
  }
  return { sicherheit: 'sicher', grund: form === 'lang' ? null : 'aus Freitext gelesen' };
}

function alsTreffer(s: Segment, roh: string, form: 'lang' | 'kurz'): LagerplatzTreffer {
  const { sicherheit, grund } = bewerte(s, form);
  return { code: codeAus(s), roh: roh.trim().replace(/\s+/g, ' '), segment: s, form, sicherheit, grund, klartext: klartextAus(s) };
}

/**
 * Findet alle Lagerplätze in einem Text — erst die lange Form, dann die kurze
 * im Rest. Doppelte Codes werden zusammengefasst.
 */
export function findeLagerplaetze(text: string): LagerplatzTreffer[] {
  if (!text || !text.trim()) return [];
  const vorbereitet = vereinheitliche(text);
  const gefunden = new Map<string, LagerplatzTreffer>();

  // 1) Lange Form
  let rest = vorbereitet;
  for (const m of vorbereitet.matchAll(LANG)) {
    const seg: Segment = {
      halle: Number(m[1]),
      regal: m[2],
      // m[3] ist der Teil NACH dem E — bei "EE F02" also "E" (Ebene E).
      ebene: m[3],
      fach: m[4],
      kiste: normZusatz(m[5] ? `K${m[5]}` : (m[6] ?? '0')),
    };
    const t = alsTreffer(seg, m[0], 'lang');
    if (!gefunden.has(t.code)) gefunden.set(t.code, t);
    rest = rest.replace(m[0], ' '); // nicht nochmal als Kurzform lesen
  }

  // 2) Kurze Form im verbleibenden Text
  for (const m of rest.matchAll(KURZ)) {
    const basis = {
      halle: Number(m[1]),
      regal: m[2],
      ebene: m[3],
      fach: m[4],
    };
    // "K2+3" nennt zwei Kisten am selben Fach – beide zählen.
    const kisten: Array<string | null> = m[5] ? [normZusatz(`K${m[5]}`)] : [null];
    if (m[6]) for (const z of m[6].matchAll(/\d{1,3}/g)) kisten.push(normZusatz(`K${z[0]}`));

    for (const kiste of kisten) {
      const t = alsTreffer({ ...basis, kiste }, m[0], 'kurz');
      if (!gefunden.has(t.code)) gefunden.set(t.code, t);
    }
  }

  return [...gefunden.values()];
}

/** Der aussagekräftigste Treffer: lange Form schlägt kurze, sicher schlägt unsicher. */
export function besterTreffer(treffer: LagerplatzTreffer[]): LagerplatzTreffer | null {
  const brauchbar = treffer.filter((t) => t.sicherheit !== 'ignoriert');
  if (!brauchbar.length) return null;
  const rang = (t: LagerplatzTreffer) => (t.sicherheit === 'sicher' ? 2 : 0) + (t.form === 'lang' ? 1 : 0);
  return brauchbar.reduce((a, b) => (rang(b) > rang(a) ? b : a));
}
