import 'server-only'

/**
 * Der Bestandsabgleich — die schnelle Spur.
 *
 * WARUM EIGENS: Der Artikelabgleich liest Texte, Preise und Bilder und geht
 * deshalb seitenweise über Stunden durch den Stamm. Ein verkauftes Gerät darf
 * aber nicht stundenlang weiter angeboten werden. Bestände sind billig zu
 * lesen — eine Zeile je Lager und Variante, keine Texte, keine Bilder —, also
 * laufen sie öfter und in einem Rutsch.
 *
 * Was hier passiert, entscheidet über das Herunternehmen: Ein Artikel ohne
 * Bestand hat im Inserat nichts mehr zu suchen (siehe inserat.ts). Er fällt
 * damit aus der nächsten Importdatei, und Maschinensucher nimmt ihn beim
 * nächsten Abgleich vom Markt.
 *
 * DIE HEIKLE STELLE ist nicht das Lesen, sondern das FEHLEN: Wer gar keine
 * Bestandszeile hat, hat nichts auf Lager. Das stimmt — solange der Lauf
 * wirklich alles gelesen hat. Bricht er in der Mitte ab oder fehlen dem
 * API-Benutzer die Rechte auf ein Lager, sieht ein halber Bestand genauso aus
 * wie ein leerer. Deshalb wird auf Null nur gesetzt, wenn der Durchlauf
 * vollständig war UND die Menge der Betroffenen plausibel ist.
 */

import { sql } from '@/lib/db'
import { plentyEingerichtet, plentyGet, type PlentyListe } from './client'

/** Zeilen je Aufruf. Plenty deckelt das je nach Ausbaustufe selbst. */
export const PRO_SEITE = 250

/** Wie viele Seiten ein Lauf höchstens liest, bevor er abbricht. */
export const MAX_SEITEN = Number(process.env.PLENTY_BESTAND_SEITEN ?? 200)

/** Ab diesem Anteil genullter markierter Artikel wird nicht genullt. */
export const NULLUNG_ANTEIL = 0.3

/** Unterhalb so weniger Artikel greift die Sicherung nicht. */
export const NULLUNG_MINDEST = 5

export interface Bestandszeile {
  variationId?: number | null
  itemId?: number | null
  warehouseId?: number | null
  netStock?: number | null
  physicalStock?: number | null
}

/**
 * Bestand je Variante über alle Lager.
 *
 * Gezählt wird der NETTO-Bestand: Was reserviert ist, gehört schon jemandem.
 * Ein Marktplatz-Inserat für ein bereits verkauftes Gerät ist der teuerste
 * Fehler dieser Strecke — es kommen Anfragen, und am Ende steht eine Absage.
 */
export function fasseZusammen(zeilen: Bestandszeile[]): Map<number, number> {
  const summen = new Map<number, number>()
  for (const zeile of zeilen) {
    const id = Number(zeile?.variationId)
    if (!Number.isFinite(id) || id <= 0) continue
    const menge = Number(zeile?.netStock ?? zeile?.physicalStock ?? 0)
    summen.set(id, (summen.get(id) ?? 0) + (Number.isFinite(menge) ? menge : 0))
  }
  return summen
}

export interface Nullungsfrage {
  /** Markierte Artikel insgesamt. */
  markiert: number
  /** Davon solche, die jetzt auf 0 gesetzt würden. */
  wuerdenGenullt: number
  /** Hat der Lauf den ganzen Bestand gelesen? */
  vollstaendig: boolean
}

export interface Nullungsbefund {
  erlaubt: boolean
  meldung: string | null
}

/**
 * Darf auf Null gesetzt werden?
 *
 * Nein, wenn der Lauf abgebrochen ist — ein halb gelesener Bestand sieht aus
 * wie ein leeres Lager. Und nein, wenn auf einen Schlag ein großer Teil des
 * markierten Bestands verschwinden würde: Das ist fast nie ein Verkaufstag,
 * sondern ein fehlendes Recht auf ein Lager oder eine Plenty-Umstellung.
 * Lieber ein veralteter Bestand für ein paar Stunden als ein leerer
 * Marktplatz.
 */
export function pruefeNullung({ markiert, wuerdenGenullt, vollstaendig }: Nullungsfrage): Nullungsbefund {
  if (!vollstaendig) {
    return {
      erlaubt: false,
      meldung:
        'Der Bestandslauf ist nicht durchgelaufen — es wird nichts auf Null gesetzt. ' +
        'Ein halb gelesener Bestand sieht aus wie ein leeres Lager.',
    }
  }
  if (wuerdenGenullt === 0) return { erlaubt: true, meldung: null }

  if (wuerdenGenullt >= NULLUNG_MINDEST && markiert > 0 && wuerdenGenullt > markiert * NULLUNG_ANTEIL) {
    return {
      erlaubt: false,
      meldung:
        `${wuerdenGenullt} von ${markiert} markierten Artikeln haetten auf einen Schlag keinen Bestand mehr. ` +
        'Das ist eher ein fehlendes Lagerrecht als ein Verkaufstag — die Bestaende bleiben stehen, bitte pruefen.',
    }
  }
  return { erlaubt: true, meldung: null }
}

export interface Bestandsbericht {
  gelesen: number
  varianten: number
  /** Artikel, deren Bestand in unserer Tabelle angefasst wurde. */
  aktualisiert: number
  /** Markierte Artikel, die dabei auf 0 gefallen sind — die gehen offline. */
  aufNull: number
  vollstaendig: boolean
  seiten: number
  hinweise: string[]
}

/** Die Bestandszeilen aus Plenty, Seite für Seite. */
async function alleZeilen(): Promise<{ zeilen: Bestandszeile[]; vollstaendig: boolean; seiten: number }> {
  const zeilen: Bestandszeile[] = []
  let seite = 1

  for (; seite <= MAX_SEITEN; seite++) {
    const res = await plentyGet<PlentyListe<Bestandszeile>>(
      `/rest/stockmanagement/stock?itemsPerPage=${PRO_SEITE}&page=${seite}`,
    )
    const eintraege = res?.entries ?? []
    zeilen.push(...eintraege)
    if (res?.isLastPage === true || eintraege.length === 0) {
      return { zeilen, vollstaendig: true, seiten: seite }
    }
  }
  return { zeilen, vollstaendig: false, seiten: seite - 1 }
}

export async function bestandAbgleichen(): Promise<Bestandsbericht> {
  if (!plentyEingerichtet()) {
    throw new Error('PlentyONE ist nicht eingerichtet (PLENTY_BASE_URL / PLENTY_USER / PLENTY_PASSWORD).')
  }

  const hinweise: string[] = []
  const { zeilen, vollstaendig, seiten } = await alleZeilen()
  if (!vollstaendig) {
    hinweise.push(`Abbruch nach ${seiten} Seiten (PLENTY_BESTAND_SEITEN) — es wurde nur aktualisiert, was gelesen wurde.`)
  }

  const summen = fasseZusammen(zeilen)
  const ids = [...summen.keys()]
  const mengen = ids.map((id) => Math.trunc(summen.get(id) ?? 0))

  // ---- Was wir gesehen haben, wird geschrieben ---------------------------
  // In Blöcken, weil ein einzelnes Statement mit zehntausenden Werten die
  // Verbindung ausbremst.
  let aktualisiert = 0
  const BLOCK = 2000
  for (let i = 0; i < ids.length; i += BLOCK) {
    const teilIds = ids.slice(i, i + BLOCK)
    const teilMengen = mengen.slice(i, i + BLOCK)
    const betroffen = await sql<{ id: string }[]>`
      update artikel a
         set bestand = q.menge, bestand_am = now(), updated_at = now()
        from (select * from unnest(${teilIds}::bigint[], ${teilMengen}::int[]) as t(vid, menge)) q
       where a.plenty_variation_id = q.vid
      returning a.id::text
    `
    aktualisiert += betroffen.length
  }

  // ---- Und was fehlt? ---------------------------------------------------
  // Keine Bestandszeile heißt: nichts auf Lager. Das ist der Auslöser fürs
  // Herunternehmen — und die Stelle, an der ein unvollständiger Lauf teuer
  // würde. Deshalb erst zählen, dann prüfen, dann schreiben.
  const [{ markiert }] = await sql<{ markiert: number }[]>`
    select count(*)::int as markiert from artikel where ms_markiert
  `
  const [{ betroffen }] = await sql<{ betroffen: number }[]>`
    select count(*)::int as betroffen
      from artikel
     where ms_markiert
       and coalesce(bestand, 0) <> 0
       and not (plenty_variation_id = any(${ids}::bigint[]))
  `

  const befund = pruefeNullung({ markiert, wuerdenGenullt: betroffen, vollstaendig })
  let aufNull = 0

  if (befund.erlaubt) {
    const genullt = await sql<{ id: string }[]>`
      update artikel
         set bestand = 0, bestand_am = now(), updated_at = now()
       where coalesce(bestand, 0) <> 0
         and not (plenty_variation_id = any(${ids}::bigint[]))
      returning id::text, ms_markiert
    `
    aufNull = (genullt as unknown as Array<{ ms_markiert: boolean }>).filter((z) => z.ms_markiert).length
    aktualisiert += genullt.length
  }
  if (befund.meldung) hinweise.push(befund.meldung)

  return {
    gelesen: zeilen.length,
    varianten: ids.length,
    aktualisiert,
    aufNull,
    vollstaendig,
    seiten,
    hinweise,
  }
}
