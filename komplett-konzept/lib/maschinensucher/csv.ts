/**
 * Die Importdatei: aus Inseraten wird eine Tabelle.
 *
 * Maschinensucher liest Textdateien, in denen ein Inserat eine Zeile ist und
 * die Spalten durch ein Trennzeichen getrennt sind. Zwei Dinge können dabei
 * schiefgehen, und beide sind hier abgefangen:
 *
 * 1. EIN TRENNZEICHEN IM TEXT. Steht in der Beschreibung ein Semikolon,
 *    zerfällt die Zeile in zwei — ab da ist alles verschoben. Deshalb wird
 *    jedes Feld in Anführungszeichen gesetzt, sobald es Trennzeichen,
 *    Anführungszeichen oder Umbrüche enthält (RFC 4180).
 *
 * 2. EIN ZEILENUMBRUCH IM TEXT. Formal erlaubt, solange das Feld in
 *    Anführungszeichen steht — aber ein Importer, der die Datei zuerst in
 *    Zeilen schneidet und erst dann in Spalten, zerlegt daran den halben
 *    Katalog. Wir wissen nicht, wie ihrer arbeitet, und ein zerschossener
 *    Import kostet mehr als ein verlorener Absatz. Deshalb werden Umbrüche
 *    standardmäßig zu Leerzeichen; wer es anders braucht, stellt es um.
 */

import type { FeldKey } from './felder'
import type { Spaltenplan } from './felder'

export type Umbruchbehandlung = 'entfernen' | 'behalten'

export interface CsvOptionen {
  trenner: string
  /** Kopfzeile mitschreiben. */
  kopfzeile: boolean
  umbrueche: Umbruchbehandlung
  /** Zeilenende. CRLF ist das, was Tabellenprogramme und Importer erwarten. */
  zeilenende: string
}

export const CSV_STANDARD: CsvOptionen = {
  trenner: ';',
  kopfzeile: true,
  umbrueche: 'entfernen',
  zeilenende: '\r\n',
}

/** Ein einzelnes Feld, nach RFC 4180 gesichert. */
export function feld(wert: string, optionen: CsvOptionen): string {
  let text = wert ?? ''
  if (optionen.umbrueche === 'entfernen') {
    text = text.replace(/\s*\r?\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim()
  }
  const mussQuoten =
    text.includes(optionen.trenner) || text.includes('"') || text.includes('\n') || text.includes('\r')
  return mussQuoten ? `"${text.split('"').join('""')}"` : text
}

/** Eine Zeile aus den Werten eines Inserats, in der Reihenfolge des Plans. */
export function zeile(
  werte: Partial<Record<FeldKey, string>>,
  plan: Spaltenplan,
  optionen: CsvOptionen = CSV_STANDARD,
): string {
  return plan.spalten
    .map((spalte) => feld(spalte.feld ? (werte[spalte.feld] ?? '') : '', optionen))
    .join(optionen.trenner)
}

/** Die ganze Datei. */
export function baueCsv(
  inserate: Array<Partial<Record<FeldKey, string>>>,
  plan: Spaltenplan,
  optionen: Partial<CsvOptionen> = {},
): string {
  const opt: CsvOptionen = { ...CSV_STANDARD, ...optionen }
  const zeilen: string[] = []
  if (opt.kopfzeile) {
    zeilen.push(plan.spalten.map((s) => feld(s.kopf, opt)).join(opt.trenner))
  }
  for (const werte of inserate) zeilen.push(zeile(werte, plan, opt))
  // Abschließendes Zeilenende: manche Importer verschlucken sonst den letzten
  // Datensatz, weil sie auf den Umbruch warten.
  return zeilen.join(opt.zeilenende) + opt.zeilenende
}

/**
 * Text in Bytes, in der Kodierung, die die Gegenstelle erwartet.
 *
 * UTF-8 bekommt ein BOM: Ohne das lesen ältere Importer "Größe" als "GrÃ¶ÃŸe",
 * und der Fehler fällt erst im fertigen Inserat auf. Bei latin1 werden
 * Zeichen, die es dort nicht gibt, ersetzt statt die Datei zu zerstören.
 */
export function kodiere(text: string, kodierung: 'utf-8' | 'latin1'): Buffer {
  if (kodierung === 'latin1') {
    const ersetzt = text
      .replace(/[‘’‚]/g, "'")
      .replace(/[“”„]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/·/g, '-')
      .replace(/€/g, 'EUR')
    return Buffer.from(ersetzt, 'latin1')
  }
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])
}
