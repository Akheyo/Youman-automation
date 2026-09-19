/**
 * Marken- und Zustandsvorschriften, die vor jeder Veröffentlichung geprüft werden.
 *
 * WARUM ALS PRÜFUNG UND NICHT ALS PROMPT-ANWEISUNG: Ein Textgenerator hält
 * sich an eine Anweisung „meistens". Bei einer Vorschrift, deren Verletzung
 * laut Hersteller bis zu 10.000 € Bußgeld kostet, ist „meistens" die falsche
 * Bauweise. Deshalb steht hier eine Sperre, die den Artikel aufhält, statt
 * einer Bitte, die überhört werden kann.
 *
 * Quelle: internes Ablaufdokument „Plenty_SOP_3".
 */

export type Schwere = 'sperre' | 'warnung';

export interface Befund {
  schwere: Schwere;
  regel: string;
  meldung: string;
}

// ---------------------------------------------------------------------------
// SKF und FAG — „Neu" ist verboten
// ---------------------------------------------------------------------------

export const KUGELLAGER_HERSTELLER = ['SKF', 'FAG'];

/** Wortlaut, der bei SKF und FAG in jedem Listing stehen muss. */
export const PFLICHTSATZ_KUGELLAGER =
  'Neu Sonstiges – original verpackt, ungeöffnet und unbenutzt. Laut Hersteller dürfen wir nicht NEU schreiben.';

/**
 * Der Satz wird beim Kopieren gern verändert: anderer Bindestrich, andere
 * Anführungszeichen, und „dürfen" wird je nach Tastatur und Zeichensatz zu
 * „duerfen" oder „durfen". Geprüft wird deshalb auf den tragenden Kern in
 * allen drei Schreibweisen — eine Sperre, die bei einem Umlaut aussetzt,
 * schützt niemanden.
 */
const PFLICHTSATZ_KERN = /laut\s+hersteller\s+d(?:ü|ue|u)rfen\s+wir\s+nicht\s+neu\s+schreiben/i;

// ---------------------------------------------------------------------------
// LAPP — der Herstellername darf nirgends auftauchen
// ---------------------------------------------------------------------------

export const LAPP_HERSTELLER = 'LAPP';

/**
 * Produktlinien von LAPP. Sie dürfen im Listing ebenso wenig vorkommen wie der
 * Herstellername selbst (bestätigt September 2026).
 *
 * FOLGE FÜR DEN TEXT: Ein solcher Artikel muss generisch beschrieben werden —
 * Bauart, Aderzahl, Querschnitt, Mantelwerkstoff, Norm. „ÖLFLEX CLASSIC 110
 * 5G1,5" wird zu „Steuerleitung 5G1,5 mm² PVC, ölbeständig". Das ist kein
 * Schönheitsfehler, sondern die einzige zulässige Form.
 */
export const LAPP_LINIEN = [
  'ÖLFLEX',
  'OELFLEX',
  'UNITRONIC',
  'HITRONIC',
  'SKINTOP',
  'EPIC',
  'SILVYN',
  'FLEXIMARK',
  'ETHERLINE',
];

/**
 * „EPIC" ist auch ein normales Wort und taugt allein nicht als Nachweis, dass
 * ein Artikel von LAPP stammt — sonst sperrte die Prüfung jedes Listing, in
 * dem zufällig „epic" steht. Als LAPP-Hinweis zählt es erst, wenn etwas
 * anderes bereits darauf deutet. Verboten ist es dann trotzdem.
 */
const LAPP_SCHWACHE_HINWEISE = ['EPIC'];

/** Sucht ein Wort als eigenständiges Wort, nicht als Silbe. */
function enthaeltWort(text: string, wort: string): boolean {
  const geschuetzt = wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${geschuetzt}([^\\p{L}]|$)`, 'iu').test(text);
}

export function istLappArtikel(hersteller: string | null | undefined, texte: string[]): boolean {
  if (hersteller && enthaeltWort(hersteller, LAPP_HERSTELLER)) return true;
  if (texte.some((t) => enthaeltWort(t ?? '', LAPP_HERSTELLER))) return true;
  const eindeutig = LAPP_LINIEN.filter((l) => !LAPP_SCHWACHE_HINWEISE.includes(l));
  return eindeutig.some((linie) => texte.some((t) => enthaeltWort(t ?? '', linie)));
}

// ---------------------------------------------------------------------------
// Titellängen (SOP)
// ---------------------------------------------------------------------------

export const MAX_TITEL_1 = 60;
export const MAX_TITEL_2_3 = 80;

// ---------------------------------------------------------------------------
// Die Prüfung
// ---------------------------------------------------------------------------

export interface ListingEntwurf {
  hersteller?: string | null;
  /** Name 1 in Plenty — die kurze Fassung. */
  titel1: string;
  titel2?: string | null;
  titel3?: string | null;
  beschreibung: string;
  /** Zustand, wie er auf eBay gesetzt wird. */
  zustand: 'neu_versiegelt' | 'neu' | 'gebraucht' | 'defekt';
}

/**
 * Prüft einen Listing-Entwurf. Ein Befund mit `schwere: 'sperre'` heißt:
 * Der Artikel darf nicht raus.
 */
export function pruefeListing(entwurf: ListingEntwurf): Befund[] {
  const befunde: Befund[] = [];
  const texte = [entwurf.titel1, entwurf.titel2 ?? '', entwurf.titel3 ?? '', entwurf.beschreibung];
  const alles = texte.join('\n');

  // --- SKF / FAG -----------------------------------------------------------
  const istKugellager = KUGELLAGER_HERSTELLER.some((h) => entwurf.hersteller && enthaeltWort(entwurf.hersteller, h));
  const neuwertig = entwurf.zustand === 'neu' || entwurf.zustand === 'neu_versiegelt';

  if (istKugellager && neuwertig) {
    if (entwurf.zustand === 'neu_versiegelt') {
      befunde.push({
        schwere: 'sperre',
        regel: 'SKF/FAG',
        meldung: 'Bei SKF und FAG darf der Zustand nicht „Neu" sein, sondern muss „Neu: Sonstige" lauten.',
      });
    }
    if (!PFLICHTSATZ_KERN.test(entwurf.beschreibung)) {
      befunde.push({
        schwere: 'sperre',
        regel: 'SKF/FAG',
        meldung:
          'Der Pflichtsatz fehlt in der Beschreibung. Wortlaut: „' + PFLICHTSATZ_KUGELLAGER + '" ' +
          '(laut Hersteller bis zu 10.000 € Bußgeld).',
      });
    }
  }

  // --- LAPP ----------------------------------------------------------------
  if (istLappArtikel(entwurf.hersteller, texte)) {
    if (enthaeltWort(alles, LAPP_HERSTELLER)) {
      befunde.push({
        schwere: 'sperre',
        regel: 'LAPP',
        meldung: 'Der Herstellername „LAPP" darf in diesem Listing nirgends vorkommen — auch nicht im Herstellerfeld.',
      });
    }
    const linien = LAPP_LINIEN.filter((l) => enthaeltWort(alles, l));
    if (linien.length > 0) {
      befunde.push({
        schwere: 'sperre',
        regel: 'LAPP',
        meldung:
          `Produktlinie im Text (${linien.join(', ')}) — auch die darf nicht vorkommen. ` +
          'Den Artikel generisch beschreiben: Bauart, Aderzahl, Querschnitt, Mantelwerkstoff, Norm.',
      });
    }
  }

  // --- Defekte Ware --------------------------------------------------------
  if (entwurf.zustand === 'defekt') {
    if (!/defekt/i.test(entwurf.titel1)) {
      befunde.push({ schwere: 'sperre', regel: 'Defekt', meldung: '„defekt" fehlt im Titel.' });
    }
    if (!/defekt/i.test(entwurf.beschreibung)) {
      befunde.push({ schwere: 'sperre', regel: 'Defekt', meldung: '„defekt" fehlt in der Beschreibung.' });
    }
  }

  // --- Titellängen ---------------------------------------------------------
  if (entwurf.titel1.length > MAX_TITEL_1) {
    befunde.push({
      schwere: 'sperre',
      regel: 'Titellänge',
      meldung: `Titel 1 hat ${entwurf.titel1.length} Zeichen, erlaubt sind ${MAX_TITEL_1}.`,
    });
  }
  for (const [nr, titel] of [
    [2, entwurf.titel2],
    [3, entwurf.titel3],
  ] as Array<[number, string | null | undefined]>) {
    if (titel && titel.length > MAX_TITEL_2_3) {
      befunde.push({
        schwere: 'sperre',
        regel: 'Titellänge',
        meldung: `Titel ${nr} hat ${titel.length} Zeichen, erlaubt sind ${MAX_TITEL_2_3}.`,
      });
    }
  }

  return befunde;
}

/** Darf der Artikel raus? */
export function darfVeroeffentlichen(befunde: Befund[]): boolean {
  return !befunde.some((b) => b.schwere === 'sperre');
}
