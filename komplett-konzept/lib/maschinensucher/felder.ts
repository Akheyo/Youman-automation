/**
 * Die Felder eines Maschinensucher-Inserats — und wie sie auf die Spalten der
 * Importdatei kommen.
 *
 * WARUM DAS HIER EINE EIGENE DATEI IST: Maschinensucher liest Importdateien
 * SPALTENWEISE. Die Reihenfolge der Spalten ist die Schnittstelle, nicht die
 * Überschrift — eine verrutschte Spalte schreibt das Baujahr in den Preis, und
 * das fällt niemandem auf, bis ein Bagger für 1.998 € online steht.
 *
 * Die verbindliche Reihenfolge steht in der BEISPIELDATEI, die Maschinensucher
 * im Händlerkonto zum Download anbietet (Konto → Datenimport). Die liegt uns
 * hier nicht vor, und geraten wird sie nicht: Statt Spaltennamen zu erfinden,
 * nimmt diese Datei die Kopfzeile der echten Beispieldatei entgegen
 * (MASCHINENSUCHER_KOPFZEILE) und ordnet unsere Felder darauf zu. Solange
 * keine hinterlegt ist, wird die unten stehende Standardreihenfolge
 * ausgeliefert — und die Oberfläche sagt ausdrücklich, dass sie ungeprüft ist.
 *
 * Das ist dasselbe Vorgehen wie beim Lagerplatz-Scan: zur Laufzeit lernen,
 * was die Gegenstelle wirklich erwartet, statt es im Code festzuschreiben.
 */

/** Alle Felder, die wir aus unseren Artikeldaten befüllen können. */
export type FeldKey =
  | 'inseratsnummer'
  | 'kategorie'
  | 'titel'
  | 'hersteller'
  | 'typ'
  | 'baujahr'
  | 'zustand'
  | 'beschreibung'
  | 'preis'
  | 'waehrung'
  | 'preisart'
  | 'mwst'
  | 'menge'
  | 'seriennummer'
  | 'interne_nummer'
  | 'land'
  | 'plz'
  | 'ort'
  | 'gewicht'
  | 'laenge'
  | 'breite'
  | 'hoehe'
  | 'ansprechpartner'
  | 'telefon'
  | 'email'
  | 'url'
  | 'bild1'
  | 'bild2'
  | 'bild3'
  | 'bild4'
  | 'bild5'
  | 'bild6'
  | 'bild7'
  | 'bild8'

export interface Feld {
  key: FeldKey
  /** Überschrift, wenn wir die Datei selbst überschreiben (Standardfall). */
  kopf: string
  /**
   * Woran diese Spalte in einer FREMDEN Kopfzeile erkannt wird. Normalisiert
   * verglichen (klein, ohne Umlaute, ohne Sonderzeichen), Treffer wenn die
   * Überschrift gleich ist oder das Synonym enthält.
   */
  synonyme: string[]
  /** Ohne dieses Feld ist das Inserat unvollständig und geht nicht raus. */
  pflicht: boolean
  zweck: string
}

/** Wie viele Bilder je Inserat übergeben werden. */
export const MAX_BILDER = 8

/**
 * Die Standardreihenfolge.
 *
 * ACHTUNG: Sie ist unsere beste Annahme, nicht die amtliche Spaltenfolge —
 * siehe Kopfkommentar. 33 Spalten, damit die von Maschinensucher genannte
 * Mindestbreite von 32 Spalten sicher erreicht wird.
 */
export const FELDER: Feld[] = [
  {
    key: 'inseratsnummer',
    kopf: 'Inseratsnummer',
    synonyme: ['inseratsnummer', 'inseratnr', 'anzeigennummer', 'referenz', 'adid', 'id'],
    pflicht: true,
    zweck:
      'Unsere feste Nummer des Inserats. Daran erkennt Maschinensucher beim nächsten Lauf, ' +
      'dass es dasselbe Inserat ist — ohne sie entstünde bei jedem Import ein neues.',
  },
  {
    key: 'kategorie',
    kopf: 'Kategorie',
    synonyme: ['kategorie', 'category', 'warengruppe', 'rubrik'],
    pflicht: true,
    zweck: 'Die Maschinensucher-Kategorie. Ohne sie landet das Inserat nirgendwo.',
  },
  {
    key: 'titel',
    kopf: 'Maschinenbezeichnung',
    synonyme: ['maschinenbezeichnung', 'bezeichnung', 'titel', 'headline', 'name'],
    pflicht: true,
    zweck: 'Die Überschrift des Inserats.',
  },
  {
    key: 'hersteller',
    kopf: 'Hersteller',
    synonyme: ['hersteller', 'manufacturer', 'marke', 'fabrikat'],
    pflicht: false,
    zweck: 'Hersteller laut Typenschild. Leer, wenn keines lesbar war — nicht geraten.',
  },
  {
    key: 'typ',
    kopf: 'Typ',
    synonyme: ['typ', 'modell', 'model', 'typenbezeichnung'],
    pflicht: false,
    zweck: 'Modell- oder Typenbezeichnung.',
  },
  {
    key: 'baujahr',
    kopf: 'Baujahr',
    synonyme: ['baujahr', 'year', 'jahr'],
    pflicht: false,
    zweck: 'Nur wenn es am Gerät stand.',
  },
  {
    key: 'zustand',
    kopf: 'Zustand',
    synonyme: ['zustand', 'condition'],
    pflicht: false,
    zweck: 'Zustand im Klartext, wie am Regal erfasst.',
  },
  {
    key: 'beschreibung',
    kopf: 'Beschreibung',
    synonyme: ['beschreibung', 'description', 'text', 'langtext'],
    pflicht: true,
    zweck: 'Der Beschreibungstext aus dem Listing, ohne HTML.',
  },
  {
    key: 'preis',
    kopf: 'Preis',
    synonyme: ['preis', 'price', 'nettopreis', 'verkaufspreis'],
    pflicht: true,
    zweck: 'Netto-Verkaufspreis. Siehe inserat.ts — auf Maschinensucher wird netto ausgezeichnet.',
  },
  {
    key: 'waehrung',
    kopf: 'Waehrung',
    synonyme: ['waehrung', 'currency', 'wahrung'],
    pflicht: false,
    zweck: 'Immer EUR.',
  },
  {
    key: 'preisart',
    kopf: 'Preisart',
    synonyme: ['preisart', 'preistyp', 'pricetype', 'mwstpflichtig'],
    pflicht: false,
    zweck: '"netto" — der Preis versteht sich zuzüglich Mehrwertsteuer.',
  },
  {
    key: 'mwst',
    kopf: 'MwSt',
    synonyme: ['mwst', 'mehrwertsteuer', 'ust', 'vat', 'steuersatz'],
    pflicht: false,
    zweck: 'Steuersatz in Prozent.',
  },
  {
    key: 'menge',
    kopf: 'Menge',
    synonyme: ['menge', 'anzahl', 'stueckzahl', 'quantity', 'stuckzahl'],
    pflicht: false,
    zweck: 'Wie viele Stück dieser Artikel verfügbar sind.',
  },
  {
    key: 'seriennummer',
    kopf: 'Seriennummer',
    synonyme: ['seriennummer', 'serialnumber', 'seriennr'],
    pflicht: false,
    zweck: 'Nur wenn sie vom Typenschild gelesen wurde.',
  },
  {
    key: 'interne_nummer',
    kopf: 'Interne Nummer',
    synonyme: ['internenummer', 'artikelnummer', 'lagernummer', 'sku', 'ean'],
    pflicht: false,
    zweck: 'Unsere EAN bzw. Artikelnummer — damit eine Anfrage im Haus zugeordnet werden kann.',
  },
  {
    key: 'land',
    kopf: 'Land',
    synonyme: ['land', 'country', 'laenderkennzeichen', 'lkz'],
    pflicht: true,
    zweck: 'Standort der Maschine. Maschinensucher sortiert danach.',
  },
  {
    key: 'plz',
    kopf: 'PLZ',
    synonyme: ['plz', 'postleitzahl', 'zip', 'postcode'],
    pflicht: true,
    zweck: 'Standort-Postleitzahl.',
  },
  {
    key: 'ort',
    kopf: 'Ort',
    synonyme: ['ort', 'stadt', 'city', 'standort'],
    pflicht: true,
    zweck: 'Standort-Ort.',
  },
  {
    key: 'gewicht',
    kopf: 'Gewicht',
    synonyme: ['gewicht', 'weight', 'kg'],
    pflicht: false,
    zweck: 'Gewicht in kg — am Regal gewogen, nie geschätzt.',
  },
  {
    key: 'laenge',
    kopf: 'Laenge',
    synonyme: ['laenge', 'lange', 'length'],
    pflicht: false,
    zweck: 'Maß in cm, nur wenn es abgelesen wurde.',
  },
  { key: 'breite', kopf: 'Breite', synonyme: ['breite', 'width'], pflicht: false, zweck: 'Maß in cm.' },
  { key: 'hoehe', kopf: 'Hoehe', synonyme: ['hoehe', 'hohe', 'height'], pflicht: false, zweck: 'Maß in cm.' },
  {
    key: 'ansprechpartner',
    kopf: 'Ansprechpartner',
    synonyme: ['ansprechpartner', 'kontakt', 'contact'],
    pflicht: false,
    zweck: 'Wer Anfragen zu diesem Inserat beantwortet.',
  },
  {
    key: 'telefon',
    kopf: 'Telefon',
    synonyme: ['telefon', 'phone', 'tel'],
    pflicht: false,
    zweck: 'Rückrufnummer.',
  },
  {
    key: 'email',
    kopf: 'E-Mail',
    synonyme: ['email', 'emailadresse', 'mail'],
    pflicht: false,
    zweck: 'Das Postfach, das der Anfragen-Radar überwacht.',
  },
  {
    key: 'url',
    kopf: 'Shop-Link',
    synonyme: ['url', 'link', 'shoplink', 'weblink'],
    pflicht: false,
    zweck: 'Adresse des Artikels im eigenen Shop, falls es sie schon gibt.',
  },
  ...Array.from({ length: MAX_BILDER }, (_, i) => ({
    key: `bild${i + 1}` as FeldKey,
    kopf: `Bild ${i + 1}`,
    synonyme: [`bild${i + 1}`, `bildurl${i + 1}`, `image${i + 1}`, `picture${i + 1}`, `foto${i + 1}`],
    pflicht: i === 0,
    zweck:
      i === 0
        ? 'Erstes Foto. Ohne Bild wird ein Inserat auf einem Maschinenmarktplatz nicht angesehen — deshalb Pflicht.'
        : `Foto ${i + 1}, falls vorhanden.`,
  })),
]

export const FELD_NACH_KEY: Record<string, Feld> = Object.fromEntries(FELDER.map((f) => [f.key, f]))

export const PFLICHTFELDER: FeldKey[] = FELDER.filter((f) => f.pflicht).map((f) => f.key)

/**
 * Vergleichsform einer Überschrift: klein, ohne Umlaute, ohne alles, was
 * keine Ziffer und kein Buchstabe ist. "Bild-URL 1" und "bildurl1" sind
 * dieselbe Spalte, und daran soll eine Zuordnung nicht scheitern.
 */
export function normKopf(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Enthält die Überschrift dieses Synonym — ohne dass unmittelbar eine Ziffer
 * folgt? Die Ausnahme ist der Grund für diese Funktion: "bild1" steckt auch in
 * "bild10", und das Titelbild wäre dann das zehnte Foto.
 */
function enthaelt(norm: string, synonym: string): boolean {
  let ab = 0
  for (;;) {
    const stelle = norm.indexOf(synonym, ab)
    if (stelle < 0) return false
    const danach = norm[stelle + synonym.length]
    if (!(danach && danach >= '0' && danach <= '9')) return true
    ab = stelle + 1
  }
}

export interface Spalte {
  /** Die Überschrift, die in der Datei steht. */
  kopf: string
  /** Welches unserer Felder hier hineingehört — null: Spalte bleibt leer. */
  feld: FeldKey | null
}

export interface Spaltenplan {
  spalten: Spalte[]
  /** 'beispieldatei', wenn die echte Kopfzeile hinterlegt ist. */
  herkunft: 'beispieldatei' | 'standard'
  /** Pflichtfelder, für die in der fremden Kopfzeile keine Spalte gefunden wurde. */
  fehlendePflicht: FeldKey[]
  /** Spalten der fremden Kopfzeile, die wir nicht befüllen können. */
  unbelegt: string[]
}

/** Der Standardplan: unsere eigene Reihenfolge, unsere eigenen Überschriften. */
export function standardPlan(): Spaltenplan {
  return {
    spalten: FELDER.map((f) => ({ kopf: f.kopf, feld: f.key })),
    herkunft: 'standard',
    fehlendePflicht: [],
    unbelegt: [],
  }
}

/**
 * Ordnet unsere Felder auf eine fremde Kopfzeile zu.
 *
 * Eine Spalte, die wir nicht erkennen, bleibt LEER statt zu verrutschen: Die
 * Breite der Zeile richtet sich nach der Kopfzeile, nicht nach unseren
 * Feldern. Lieber eine leere Spalte, die jemand sieht, als eine gefüllte,
 * die an der falschen Stelle steht.
 */
export function spaltenPlan(kopfzeile: string | null | undefined, trenner = ';'): Spaltenplan {
  const roh = (kopfzeile ?? '').trim()
  if (!roh) return standardPlan()

  const ueberschriften = roh.split(trenner).map((s) => s.trim().replace(/^"(.*)"$/s, '$1'))
  if (ueberschriften.length < 2) return standardPlan()

  const vergeben = new Set<FeldKey>()
  const spalten: Spalte[] = ueberschriften.map((kopf) => {
    const norm = normKopf(kopf)
    if (!norm) return { kopf, feld: null }
    // Erst exakt, dann "enthält" — sonst schnappt sich "bild1" die Spalte
    // "Bild 10", und das Titelbild wäre das zehnte Foto.
    const genau = FELDER.find((f) => !vergeben.has(f.key) && f.synonyme.some((s) => s === norm))
    const teil =
      genau ?? FELDER.find((f) => !vergeben.has(f.key) && f.synonyme.some((s) => s.length >= 4 && enthaelt(norm, s)))
    if (teil) vergeben.add(teil.key)
    return { kopf, feld: teil?.key ?? null }
  })

  return {
    spalten,
    herkunft: 'beispieldatei',
    fehlendePflicht: PFLICHTFELDER.filter((k) => !vergeben.has(k)),
    unbelegt: spalten.filter((s) => !s.feld).map((s) => s.kopf),
  }
}
