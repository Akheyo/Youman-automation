/**
 * Von einer Plenty-Variante zu einer Zeile in "artikel".
 *
 * Reine Umrechnung, ohne Netz und ohne Datenbank — deshalb prüfbar. Und das
 * ist nötig: Hier stehen die Einheiten. Plenty führt Gewichte in GRAMM und
 * Maße in MILLIMETERN. Wer das übersieht, stellt einen Kompressor mit
 * "12500 kg" ins Inserat, und die Speditionsanfrage kommt trotzdem.
 *
 * Was Plenty nicht führt, bleibt leer. Baujahr etwa ist kein Standardfeld —
 * es aus dem Anlagedatum abzuleiten wäre eine Erfindung, die im Inserat
 * aussieht wie eine Angabe vom Typenschild.
 */

/** Die Felder einer Plenty-Variante, soweit wir sie lesen. */
export interface PlentyVariante {
  id: number
  itemId?: number | null
  number?: string | null
  model?: string | null
  isActive?: boolean | null
  weightG?: number | null
  weightNetG?: number | null
  lengthMM?: number | null
  widthMM?: number | null
  heightMM?: number | null
  stockNet?: number | null
  variationBarcodes?: Array<{ code?: string | null }> | null
  variationSalesPrices?: Array<{ salesPriceId?: number | null; price?: number | null }> | null
  stock?: Array<{ netStock?: number | null; physicalStock?: number | null }> | null
  /**
   * Markierungen. In Plenty hängen sie am ARTIKEL (Einrichtung → Artikel →
   * Markierungen); je Artikel gibt es zwei Felder mit je eigener Liste. Wir
   * lesen sie trotzdem auch an der Variante, weil einzelne Ausbaustufen sie
   * dort mitliefern — und eine fehlende Markierung hieße hier: kein Inserat.
   */
  flagOne?: number | null
  flagTwo?: number | null
  item?: {
    id?: number | null
    manufacturerId?: number | null
    texts?: PlentyText[] | null
    condition?: number | { id?: number | null } | null
    flagOne?: number | null
    flagTwo?: number | null
  } | null
  variationDescription?: PlentyText[] | null
}

export interface PlentyText {
  lang?: string | null
  name?: string | null
  name1?: string | null
  name2?: string | null
  name3?: string | null
  description?: string | null
  shortDescription?: string | null
  technicalData?: string | null
}

export interface ArtikelDaten {
  plenty_variation_id: number
  plenty_item_id: number | null
  nummer: string | null
  ean: string | null
  titel: string | null
  beschreibung: string | null
  hersteller: string | null
  modell: string | null
  zustand: string | null
  preis_brutto: number | null
  bestand: number | null
  gewicht_kg: number | null
  laenge_cm: number | null
  breite_cm: number | null
  hoehe_cm: number | null
  aktiv: boolean
  /** Markierung 1 und 2 aus Plenty, so wie sie dort stehen. */
  flag_one: number | null
  flag_two: number | null
}

/**
 * Die Zustände, die PlentyONE kennt (Einstellungen → Artikel → Zustand).
 * Die IDs sind bei Plenty fest vergeben; der Text geht so ins Inserat.
 */
export const ZUSTAND_TEXT: Record<number, string> = {
  0: 'Neu',
  1: 'Gebraucht',
  2: 'Neu (Restposten)',
  3: 'Gebraucht (generalüberholt)',
  4: 'Defekt',
}

function zahl(wert: unknown): number | null {
  if (wert == null || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) ? n : null
}

function text(wert: unknown): string | null {
  if (typeof wert !== 'string') return null
  const sauber = wert.trim()
  return sauber ? sauber : null
}

/**
 * Der deutsche Textblock, sonst der erste vorhandene.
 *
 * Ein englischer Titel im deutschen Marktplatz ist besser als gar keiner —
 * aber nur, wenn es keinen deutschen gibt.
 */
export function deutscherText(texte: PlentyText[] | null | undefined): PlentyText | null {
  if (!Array.isArray(texte) || texte.length === 0) return null
  return texte.find((t) => (t.lang ?? '').toLowerCase() === 'de') ?? texte[0]
}

/**
 * Der Verkaufspreis.
 *
 * Gibt es mehrere Preislisten, entscheidet die konfigurierte ID. Ohne
 * Vorgabe wird die KLEINSTE salesPriceId genommen — das ist in Plenty
 * üblicherweise die Hauptpreisliste. Geraten wird dabei nichts: Welche
 * genommen wurde, meldet der Abgleich in seiner Diagnose.
 */
export function verkaufspreis(
  preise: PlentyVariante['variationSalesPrices'],
  preislisteId: number | null,
): { preis: number | null; ausListe: number | null } {
  const brauchbar = (preise ?? [])
    .map((p) => ({ id: zahl(p?.salesPriceId), preis: zahl(p?.price) }))
    .filter((p): p is { id: number | null; preis: number } => p.preis != null && p.preis > 0)

  if (brauchbar.length === 0) return { preis: null, ausListe: null }

  if (preislisteId != null) {
    const treffer = brauchbar.find((p) => p.id === preislisteId)
    return treffer ? { preis: treffer.preis, ausListe: treffer.id } : { preis: null, ausListe: null }
  }

  const sortiert = [...brauchbar].sort((a, b) => (a.id ?? 1e9) - (b.id ?? 1e9))
  return { preis: sortiert[0].preis, ausListe: sortiert[0].id }
}

/** Bestand über alle Lager. Ohne Bestandsangabe null, nicht 0 — das ist ein Unterschied. */
export function bestandSumme(variante: PlentyVariante): number | null {
  if (Array.isArray(variante.stock) && variante.stock.length > 0) {
    return variante.stock.reduce((summe, z) => summe + (zahl(z?.netStock) ?? 0), 0)
  }
  return zahl(variante.stockNet)
}

/** Der Zustand als Text, wenn Plenty einen führt. */
export function zustandText(condition: unknown): string | null {
  const id = typeof condition === 'object' && condition !== null ? zahl((condition as { id?: unknown }).id) : zahl(condition)
  return id != null ? (ZUSTAND_TEXT[id] ?? null) : null
}

export interface Abbildungsoptionen {
  /** Namen der Hersteller, nach Plenty-ID. */
  hersteller: Map<number, string>
  /** Welche Preisliste gilt — null: die kleinste vorhandene. */
  preislisteId: number | null
}

export function ausPlenty(variante: PlentyVariante, optionen: Abbildungsoptionen): ArtikelDaten {
  const texte = deutscherText(variante.variationDescription) ?? deutscherText(variante.item?.texts)
  const { preis } = verkaufspreis(variante.variationSalesPrices, optionen.preislisteId)
  const herstellerId = zahl(variante.item?.manufacturerId)

  // Gramm → Kilogramm, Millimeter → Zentimeter. Beides sind Plenty-Einheiten,
  // beides sind im Inserat andere.
  const gewichtG = zahl(variante.weightG) ?? zahl(variante.weightNetG)

  return {
    plenty_variation_id: variante.id,
    plenty_item_id: zahl(variante.itemId) ?? zahl(variante.item?.id),
    nummer: text(variante.number),
    ean: text(variante.variationBarcodes?.find((b) => text(b?.code))?.code),
    titel: text(texte?.name1) ?? text(texte?.name),
    beschreibung: text(texte?.description) ?? text(texte?.shortDescription),
    hersteller: herstellerId != null ? (optionen.hersteller.get(herstellerId) ?? null) : null,
    modell: text(variante.model),
    zustand: zustandText(variante.item?.condition),
    preis_brutto: preis,
    bestand: bestandSumme(variante),
    gewicht_kg: gewichtG != null && gewichtG > 0 ? Math.round(gewichtG) / 1000 : null,
    laenge_cm: teile(zahl(variante.lengthMM), 10),
    breite_cm: teile(zahl(variante.widthMM), 10),
    hoehe_cm: teile(zahl(variante.heightMM), 10),
    aktiv: variante.isActive !== false,
    flag_one: zahl(variante.item?.flagOne) ?? zahl(variante.flagOne),
    flag_two: zahl(variante.item?.flagTwo) ?? zahl(variante.flagTwo),
  }
}

// ---------------------------------------------------------------------------
// Die Markierung
// ---------------------------------------------------------------------------

/** Welches Markierungsfeld in Plenty über den Marktplatz entscheidet. */
export type Flagfeld = 'flagOne' | 'flagTwo' | 'beide'

export interface Markierungsregel {
  /** ID der Markierung, z. B. 27 für „Maschinensucher". */
  id: number
  feld: Flagfeld
}

/**
 * Steht die Maschinensucher-Markierung an diesem Artikel?
 *
 * DAS IST DER SCHALTER DER GANZEN STRECKE, und er steht in Plenty: Wer dort
 * die Markierung setzt, stellt das Gerät auf den Marktplatz; wer sie
 * wegnimmt, holt es zurück. Deshalb steht die Regel hier einzeln und geprüft
 * und nicht irgendwo in einer SQL-Zeile.
 *
 * Die beiden Markierungsfelder in Plenty sind getrennte Listen: Die 27 in
 * Feld 1 ist nicht dieselbe Markierung wie die 27 in Feld 2. Deshalb wird
 * standardmäßig nur das eine konfigurierte Feld gelesen — sonst ginge ein
 * Artikel online, weil in der anderen Liste zufällig dieselbe Nummer steht.
 */
export function istMarkiert(
  daten: Pick<ArtikelDaten, 'flag_one' | 'flag_two'>,
  regel: Markierungsregel,
): boolean {
  if (!Number.isFinite(regel.id) || regel.id <= 0) return false
  const eins = daten.flag_one === regel.id
  const zwei = daten.flag_two === regel.id
  if (regel.feld === 'flagOne') return eins
  if (regel.feld === 'flagTwo') return zwei
  return eins || zwei
}

function teile(wert: number | null, durch: number): number | null {
  if (wert == null || wert <= 0) return null
  return Math.round((wert / durch) * 10) / 10
}
