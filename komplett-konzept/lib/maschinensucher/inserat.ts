/**
 * Aus einem Artikel der Datenbank wird ein Maschinensucher-Inserat.
 *
 * Diese Datei rechnet und formt nur — kein Netz, keine Datenbank, damit jede
 * Regel einen Test hat. Hier wird entschieden, mit welchem Preis und welchem
 * Text ein Gerät öffentlich steht; ein Fehler an dieser Stelle ist von außen
 * sichtbar.
 *
 * DIE QUELLE IST DIE TABELLE "artikel", NICHT PLENTY. Was in der Tabelle
 * steht, hat der Abgleich dort hineingelegt — beim Abholen wird Plenty nicht
 * angefasst. Ist Plenty nachts in Wartung, geht trotzdem heraus, was zuletzt
 * bekannt war.
 *
 * ZWEI ENTSCHEIDUNGEN, DIE MAN KENNEN MUSS:
 *
 * 1. NETTOPREIS. Auf einem Händlermarktplatz wird netto ausgezeichnet. Steht
 *    in Plenty ein Bruttopreis (Voreinstellung), wird mit dem konfigurierten
 *    Satz heruntergerechnet. Ein Bruttopreis, der als Netto eingestellt wird,
 *    macht uns um den Steuersatz teurer als gewollt, und niemand sieht es dem
 *    Inserat an.
 *
 * 2. KEIN RATEN. Was in den Daten fehlt, bleibt leer. Ein erfundenes Baujahr
 *    oder ein geschätztes Gewicht steht im Inserat wie eine geprüfte Angabe —
 *    und ein Käufer richtet seinen Transport danach ein.
 */

import { MAX_BILDER, type FeldKey } from './felder'

/** Der Artikel, so wie er aus der Datenbank kommt. */
export interface Artikel {
  id: string
  plenty_variation_id: number | string
  plenty_item_id: number | string | null
  nummer: string | null
  ean: string | null
  titel: string | null
  beschreibung: string | null
  hersteller: string | null
  modell: string | null
  baujahr: string | null
  zustand: string | null
  /** postgres.js liefert numeric als Zeichenkette — deshalb beides. */
  preis_brutto: number | string | null
  waehrung: string | null
  bestand: number | null
  /** Wann der Bestand zuletzt aus Plenty geprüft wurde. */
  bestand_am?: Date | string | null
  gewicht_kg: number | string | null
  laenge_cm: number | string | null
  breite_cm: number | string | null
  hoehe_cm: number | string | null
  bilder: string[] | null
  kategorie: string | null
  aktiv: boolean | null
  gesehen_am: Date | string | null
}

/** Alles, was nicht am Artikel hängt, sondern am Betrieb. */
export interface Umgebung {
  /** Vorsatz der Inseratsnummer, z. B. "KK-". */
  nummernPraefix: string
  /** Stehen die Preise in Plenty brutto oder schon netto? */
  preisIst: 'brutto' | 'netto'
  /** Steuersatz in Prozent, mit dem vom Brutto auf Netto gerechnet wird. */
  mwst: number
  land: string
  plz: string
  ort: string
  ansprechpartner: string
  telefon: string
  email: string
  /** Maschinensucher-Kategorie, wenn nichts anderes greift. */
  kategorieStandard: string
  /** Zuordnung Suchwort → Kategorie, erster Treffer gewinnt. */
  kategorieZuordnung: Array<{ wort: string; kategorie: string }>
  /** Basis-Adresse des Webshops, für den Link zum Artikel. */
  shopBasisUrl: string
  /** Ab wann Artikeldaten als veraltet gelten (Tage ohne Abgleich). */
  veraltetNachTagen: number
  /** Ab wann ein Bestand als ungeprüft gilt (Stunden). */
  bestandAltNachStunden: number
}

export interface Inserat {
  werte: Partial<Record<FeldKey, string>>
  /** Was das Inserat unmöglich macht. Ist die Liste leer, darf es raus. */
  maengel: string[]
  /** Was auffällt, aber nicht aufhält. Steht in der Oberfläche an der Zeile. */
  hinweise: string[]
}

// ---------------------------------------------------------------------------
// Kleinteile
// ---------------------------------------------------------------------------

/** Höchstlänge der Überschrift. Lieber selbst kürzen als abgeschnitten werden. */
export const MAX_TITEL = 100

/** Höchstlänge des Beschreibungstextes. */
export const MAX_BESCHREIBUNG = 4000

/**
 * Kürzt an der letzten Wortgrenze davor. Ein mitten im Wort abgeschnittener
 * Titel sieht aus wie ein Datenfehler — und ist auch einer.
 */
export function kuerze(text: string, max: number): string {
  const sauber = text.trim()
  if (sauber.length <= max) return sauber
  const schnitt = sauber.slice(0, max)
  const luecke = schnitt.lastIndexOf(' ')
  return (luecke > max * 0.6 ? schnitt.slice(0, luecke) : schnitt).replace(/[\s,;·-]+$/, '')
}

const ENTITAETEN: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&auml;': 'ä',
  '&ouml;': 'ö',
  '&uuml;': 'ü',
  '&Auml;': 'Ä',
  '&Ouml;': 'Ö',
  '&Uuml;': 'Ü',
  '&szlig;': 'ß',
}

/**
 * Macht aus der HTML-Beschreibung einen Fließtext.
 *
 * Plenty-Beschreibungen sind HTML, weil sie so im Shop gebraucht werden. In
 * eine Importdatei gehören keine Tags: Im günstigen Fall werden sie entfernt,
 * im ungünstigen stehen sie sichtbar im Inserat. Absätze und Aufzählungen
 * bleiben als Zeilenumbrüche erhalten — ohne sie würde aus einer gegliederten
 * Beschreibung ein Textblock.
 */
export function alsFliesstext(html: string): string {
  let text = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n· ')
    .replace(/<[^>]+>/g, '')
  for (const [entitaet, zeichen] of Object.entries(ENTITAETEN)) {
    text = text.split(entitaet).join(zeichen)
  }
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Zahl mit Komma als Dezimaltrennzeichen — so liest Maschinensucher sie. */
export function zahl(wert: number, stellen = 2): string {
  return wert.toFixed(stellen).replace('.', ',')
}

/** Aus numeric/Text der Datenbank eine Zahl machen — oder null. */
export function alsZahl(wert: number | string | null | undefined): number | null {
  if (wert == null || wert === '') return null
  const n = typeof wert === 'number' ? wert : Number(String(wert).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Brutto → Netto. Der Satz kommt aus der Konfiguration, nicht aus dem Code. */
export function netto(brutto: number, mwstProzent: number): number {
  const satz = Number.isFinite(mwstProzent) && mwstProzent > 0 ? mwstProzent : 0
  return Math.round((brutto / (1 + satz / 100)) * 100) / 100
}

/**
 * Welche Maschinensucher-Kategorie passt?
 *
 * Erst die von Hand gesetzte am Artikel — wer sie gesetzt hat, wusste mehr als
 * jede Zuordnung über Suchworte. Dann die Zuordnung aus der Konfiguration,
 * dann die Auffangkategorie. Dass die Auffangkategorie gegriffen hat, wird
 * gesagt: Ein Inserat in der falschen Rubrik ist so gut wie keines.
 */
export function findeKategorie(
  artikel: Pick<Artikel, 'kategorie' | 'titel' | 'hersteller' | 'modell'>,
  umgebung: Umgebung,
): { kategorie: string; herkunft: 'artikel' | 'zuordnung' | 'standard' } {
  const eigene = (artikel.kategorie ?? '').trim()
  if (eigene) return { kategorie: eigene, herkunft: 'artikel' }

  const heuhaufen = [artikel.titel ?? '', artikel.hersteller ?? '', artikel.modell ?? ''].join(' ').toLowerCase()
  for (const eintrag of umgebung.kategorieZuordnung) {
    const wort = eintrag.wort.trim().toLowerCase()
    if (wort && heuhaufen.includes(wort)) return { kategorie: eintrag.kategorie, herkunft: 'zuordnung' }
  }
  return { kategorie: umgebung.kategorieStandard, herkunft: 'standard' }
}

/**
 * Die feste Nummer dieses Inserats — aus der Variantennummer aus Plenty.
 *
 * Trägt die Nummer den Vorsatz schon (unsere Variantennummern beginnen oft
 * mit „KK-"), wird er nicht noch einmal davorgesetzt. „KK-KK-2024-0815"
 * funktioniert zwar, sieht im Maschinensucher-Konto aber aus wie ein Fehler
 * — und wer so etwas sieht, fasst die Nummern an, an denen die Zuordnung der
 * Inserate hängt.
 */
export function inseratsnummer(artikel: Pick<Artikel, 'nummer' | 'plenty_variation_id'>, praefix: string): string {
  const kern = (artikel.nummer ?? '').trim() || String(artikel.plenty_variation_id)
  if (praefix && kern.toLowerCase().startsWith(praefix.toLowerCase())) return kern
  return `${praefix}${kern}`
}

/** Wie viele Stunden die letzte Bestandsprüfung her ist. */
export function alterInStunden(wann: Date | string | null | undefined, jetzt: Date): number | null {
  if (!wann) return null
  const zeit = wann instanceof Date ? wann.getTime() : Date.parse(String(wann))
  if (!Number.isFinite(zeit)) return null
  return Math.floor((jetzt.getTime() - zeit) / 3_600_000)
}

/** Wie viele Tage der letzte Abgleich dieses Artikels her ist. */
export function alterInTagen(gesehen: Date | string | null | undefined, jetzt: Date): number | null {
  if (!gesehen) return null
  const zeit = gesehen instanceof Date ? gesehen.getTime() : Date.parse(String(gesehen))
  if (!Number.isFinite(zeit)) return null
  return Math.floor((jetzt.getTime() - zeit) / 86_400_000)
}

// ---------------------------------------------------------------------------
// Das Inserat
// ---------------------------------------------------------------------------

/**
 * Baut das Inserat und sagt gleichzeitig, was ihm fehlt.
 *
 * Beides in einem Durchgang, damit die Oberfläche zeigen kann, was rausginge
 * UND warum es (noch) nicht rausgeht. Zwei getrennte Funktionen wären zwei
 * Wahrheiten, die auseinanderlaufen können.
 */
export function baueInserat(artikel: Artikel, umgebung: Umgebung, jetzt = new Date()): Inserat {
  const maengel: string[] = []
  const hinweise: string[] = []

  // ---- Überschrift und Text --------------------------------------------
  const titel = kuerze(artikel.titel ?? '', MAX_TITEL)
  if (!titel) maengel.push('Kein Titel — in Plenty hat die Variante keinen Namen.')

  const beschreibung = kuerze(alsFliesstext(artikel.beschreibung ?? ''), MAX_BESCHREIBUNG)
  if (!beschreibung) maengel.push('Keine Beschreibung — in Plenty steht kein Text am Artikel.')

  // ---- Verfügbarkeit ----------------------------------------------------
  // Was nicht da ist, wird nicht angeboten. Eine Anfrage zu einem verkauften
  // Gerät kostet Vertrauen, und zwar bei dem, der sich gemeldet hat.
  if (artikel.aktiv === false) maengel.push('In Plenty inaktiv — inaktive Artikel gehen nicht auf den Marktplatz.')
  if (artikel.bestand != null && artikel.bestand <= 0) maengel.push('Kein Bestand.')

  // ---- Preis ------------------------------------------------------------
  const brutto = alsZahl(artikel.preis_brutto)
  let preisFeld = ''
  if (brutto == null || brutto <= 0) {
    maengel.push('Kein Preis — ohne Preis kein Inserat.')
  } else {
    preisFeld = zahl(umgebung.preisIst === 'netto' ? brutto : netto(brutto, umgebung.mwst))
  }

  // ---- Bilder -----------------------------------------------------------
  const alleBilder = (artikel.bilder ?? []).filter((b) => typeof b === 'string' && b.trim())
  const bilder = alleBilder.slice(0, MAX_BILDER)
  if (bilder.length === 0) maengel.push('Keine Fotos — ein Inserat ohne Bild wird nicht angesehen.')
  if (alleBilder.length > MAX_BILDER) {
    hinweise.push(`${alleBilder.length} Fotos vorhanden, übertragen werden die ersten ${MAX_BILDER}.`)
  }

  // ---- Kategorie und Standort ------------------------------------------
  const { kategorie, herkunft } = findeKategorie(artikel, umgebung)
  if (!kategorie) {
    maengel.push('Keine Maschinensucher-Kategorie (MASCHINENSUCHER_KATEGORIE oder am Artikel setzen).')
  } else if (herkunft === 'standard') {
    hinweise.push(`Auffangkategorie „${kategorie}" — keine Zuordnung hat gegriffen.`)
  }

  if (!umgebung.plz || !umgebung.ort || !umgebung.land) {
    maengel.push('Kein Standort hinterlegt (MASCHINENSUCHER_PLZ / _ORT / _LAND).')
  }

  // ---- Was auffällt, aber nicht aufhält ---------------------------------
  const alter = alterInTagen(artikel.gesehen_am, jetzt)
  if (alter == null) {
    hinweise.push('Noch nie abgeglichen — die Daten stammen nicht aus Plenty.')
  } else if (alter > umgebung.veraltetNachTagen) {
    hinweise.push(`Seit ${alter} Tagen nicht mehr im Abgleich gesehen — Preis und Bestand könnten veraltet sein.`)
  }
  const bestandAlter = alterInStunden(artikel.bestand_am, jetzt)
  if (bestandAlter == null) {
    hinweise.push('Bestand noch nie geprüft — der Bestandsabgleich lief für diesen Artikel noch nicht.')
  } else if (bestandAlter > umgebung.bestandAltNachStunden) {
    // Der teuerste Fehler dieser Strecke ist ein Inserat für ein Gerät, das
    // schon verkauft ist. Ein alter Bestand ist der Weg dorthin.
    hinweise.push(`Bestand seit ${bestandAlter} Stunden nicht geprüft.`)
  }
  if (!artikel.hersteller) hinweise.push('Kein Hersteller hinterlegt.')
  if (!artikel.baujahr) hinweise.push('Kein Baujahr — auf Maschinenmarktplätzen die erste Rückfrage.')
  if (alsZahl(artikel.gewicht_kg) == null) hinweise.push('Kein Gewicht — Transportfrage bleibt offen.')

  // ---- Zusammensetzen ---------------------------------------------------
  const gewicht = alsZahl(artikel.gewicht_kg)
  const laenge = alsZahl(artikel.laenge_cm)
  const breite = alsZahl(artikel.breite_cm)
  const hoehe = alsZahl(artikel.hoehe_cm)
  const shopBasis = umgebung.shopBasisUrl.replace(/\/+$/, '')

  const werte: Partial<Record<FeldKey, string>> = {
    inseratsnummer: inseratsnummer(artikel, umgebung.nummernPraefix),
    kategorie,
    titel,
    hersteller: artikel.hersteller ?? '',
    typ: artikel.modell ?? '',
    baujahr: artikel.baujahr ?? '',
    zustand: artikel.zustand ?? '',
    beschreibung,
    preis: preisFeld,
    waehrung: artikel.waehrung ?? 'EUR',
    preisart: 'netto',
    mwst: zahl(umgebung.mwst, 0),
    menge: String(Math.max(1, artikel.bestand ?? 1)),
    seriennummer: '',
    interne_nummer: artikel.nummer ?? artikel.ean ?? String(artikel.plenty_variation_id),
    land: umgebung.land,
    plz: umgebung.plz,
    ort: umgebung.ort,
    gewicht: gewicht != null ? zahl(gewicht, 1) : '',
    laenge: laenge != null ? zahl(laenge, 0) : '',
    breite: breite != null ? zahl(breite, 0) : '',
    hoehe: hoehe != null ? zahl(hoehe, 0) : '',
    ansprechpartner: umgebung.ansprechpartner,
    telefon: umgebung.telefon,
    email: umgebung.email,
    url: shopBasis && artikel.plenty_item_id ? `${shopBasis}/a-${artikel.plenty_item_id}` : '',
  }

  bilder.forEach((url, i) => {
    werte[`bild${i + 1}` as FeldKey] = url
  })

  return { werte, maengel, hinweise }
}
