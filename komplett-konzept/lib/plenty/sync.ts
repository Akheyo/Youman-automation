import 'server-only'

/**
 * Der Abgleich: Artikelinformationen aus PlentyONE in die Tabelle "artikel".
 *
 * Er läuft SEITENWEISE und merkt sich, wo er stehen geblieben ist. Das ist
 * keine Vorsicht um ihrer selbst willen: Ein Artikelstamm hat zehntausende
 * Varianten, und ein Lauf, der bei Seite 180 abbricht, hätte ohne
 * Zwischenstand alles umsonst gelesen. Jeder Aufruf macht dort weiter, wo der
 * letzte aufgehört hat, und meldet seinen Abschnitt als eigenen Lauf ins
 * Dashboard.
 *
 * WAS ER NICHT TUT: nach Plenty zurückschreiben. Der Abgleich liest. Die
 * Markierung für Maschinensucher gehört uns und bleibt unberührt — sonst
 * würde ein Lauf die Entscheidung des Büros überschreiben.
 */

import { sql } from '@/lib/db'
import { plentyEingerichtet, plentyGet, type PlentyListe } from './client'
import { ausPlenty, type ArtikelDaten, type PlentyVariante } from './abbildung'

/** Wie viele Seiten ein Aufruf höchstens liest. */
export const SEITEN_JE_LAUF = Number(process.env.PLENTY_SYNC_SEITEN ?? 5)
/** Varianten je Seite. Plenty deckelt das je nach Ausbaustufe selbst. */
export const PRO_SEITE = 50
/** Wie viele Bildabrufe ein Aufruf höchstens macht (je Artikel einer). */
export const BILDER_JE_LAUF = Number(process.env.PLENTY_SYNC_BILDER ?? 150)

const SEITE_SCHLUESSEL = 'maschinensucher.sync_seite'

export interface Syncbericht {
  vonSeite: number
  bisSeite: number
  naechsteSeite: number | null
  fertig: boolean
  gelesen: number
  gespeichert: number
  bilderGeholt: number
  gesamtLautPlenty: number | null
  diagnose: string[]
}

// ---------------------------------------------------------------------------
// "with" aushandeln — statt Feldnamen zu raten
// ---------------------------------------------------------------------------

/**
 * Je nach PlentyONE-Ausbaustufe kennt /rest/items/variations unterschiedliche
 * `with`-Werte. Der Abgleich probiert sie einmal der Reihe nach durch und
 * merkt sich den ersten, der durchgeht — dasselbe Vorgehen wie beim
 * Lagerplatz-Scan, aus demselben Grund: Ein geratener Parameter führt zu
 * einer leeren Antwort, die aussieht wie ein leerer Artikelstamm.
 */
const WITH_KANDIDATEN = [
  'item,variationSalesPrices,variationBarcodes,stock',
  'item,variationSalesPrices,variationBarcodes',
  'item,variationSalesPrices',
  'item',
  '',
]

let gemerktesWith: string | null = null

function mitWith(pfad: string, withParam: string): string {
  return withParam ? `${pfad}&with=${withParam}` : pfad
}

function seitenPfad(seite: number, withParam: string): string {
  return mitWith(`/rest/items/variations?itemsPerPage=${PRO_SEITE}&page=${seite}`, withParam)
}

async function handleWithAus(diagnose: string[]): Promise<string> {
  if (gemerktesWith !== null) return gemerktesWith
  for (const kandidat of WITH_KANDIDATEN) {
    try {
      await plentyGet<PlentyListe<PlentyVariante>>(seitenPfad(1, kandidat))
      gemerktesWith = kandidat
      diagnose.push(kandidat ? `Varianten werden mit „with=${kandidat}" gelesen.` : 'Varianten werden ohne „with" gelesen.')
      return kandidat
    } catch (err) {
      const meldung = (err as Error).message
      // Nur bei "Parameter nicht verstanden" weiterprobieren; echte Fehler
      // (Login, Rechte, Netz) sollen sofort sichtbar werden.
      if (!/HTTP (400|422|500)/.test(meldung)) throw err
      diagnose.push(`„with=${kandidat || '(ohne)'}" wird nicht unterstützt — nächster Versuch.`)
    }
  }
  gemerktesWith = ''
  return ''
}

// ---------------------------------------------------------------------------
// Hersteller und Bilder
// ---------------------------------------------------------------------------

/** Herstellernamen, einmal je Lauf. Am Artikel steht nur die ID. */
async function herstellerKarte(diagnose: string[]): Promise<Map<number, string>> {
  const karte = new Map<number, string>()
  try {
    const res = await plentyGet<PlentyListe<{ id?: number; name?: string }> | Array<{ id?: number; name?: string }>>(
      '/rest/items/manufacturers?itemsPerPage=250',
    )
    const eintraege = Array.isArray(res) ? res : (res?.entries ?? [])
    for (const h of eintraege) {
      if (typeof h?.id === 'number' && typeof h?.name === 'string' && h.name.trim()) karte.set(h.id, h.name.trim())
    }
  } catch (err) {
    // Ohne Herstellerrechte läuft der Abgleich weiter — im Inserat bleibt das
    // Feld dann leer, statt dass der ganze Lauf scheitert.
    diagnose.push(`Herstellernamen nicht lesbar: ${(err as Error).message}`)
  }
  return karte
}

interface PlentyBild {
  url?: string | null
  urlMiddle?: string | null
  urlPreview?: string | null
  position?: number | null
}

/**
 * Die Bild-Adressen eines Artikels.
 *
 * Plenty liefert öffentliche Adressen — sie können unverändert ins Inserat.
 * Genommen wird die größte verfügbare Fassung: Auf einem Maschinenmarktplatz
 * wird in die Fotos hineingezoomt.
 */
async function bilderZu(itemId: number): Promise<string[]> {
  const holen = async (pfad: string): Promise<string[]> => {
    try {
      const res = await plentyGet<PlentyBild[] | PlentyListe<PlentyBild>>(pfad)
      const eintraege = Array.isArray(res) ? res : (res?.entries ?? [])
      return [...eintraege]
        .sort((a, b) => (a?.position ?? 99) - (b?.position ?? 99))
        .map((b) => b?.url || b?.urlMiddle || b?.urlPreview || '')
        .filter((u): u is string => Boolean(u))
    } catch {
      return []
    }
  }
  return holen(`/rest/items/${itemId}/images`)
}

// ---------------------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------------------

/**
 * Legt an oder aktualisiert — und lässt die Markierung in Ruhe.
 *
 * "kategorie" wird ebenfalls nicht angefasst: Wer sie von Hand gesetzt hat,
 * wusste mehr als jede Zuordnung über Suchworte.
 */
async function speichern(daten: ArtikelDaten, bilder: string[] | null): Promise<void> {
  await sql`
    insert into artikel (
      plenty_variation_id, plenty_item_id, nummer, ean, titel, beschreibung,
      hersteller, modell, zustand, preis_brutto, bestand,
      gewicht_kg, laenge_cm, breite_cm, hoehe_cm, aktiv,
      bilder, gesehen_am, updated_at
    ) values (
      ${daten.plenty_variation_id}, ${daten.plenty_item_id}, ${daten.nummer}, ${daten.ean},
      ${daten.titel}, ${daten.beschreibung}, ${daten.hersteller}, ${daten.modell}, ${daten.zustand},
      ${daten.preis_brutto}, ${daten.bestand},
      ${daten.gewicht_kg}, ${daten.laenge_cm}, ${daten.breite_cm}, ${daten.hoehe_cm}, ${daten.aktiv},
      ${sql.json((bilder ?? []) as never)}, now(), now()
    )
    on conflict (plenty_variation_id) do update set
      plenty_item_id = excluded.plenty_item_id,
      nummer         = excluded.nummer,
      ean            = excluded.ean,
      titel          = excluded.titel,
      beschreibung   = excluded.beschreibung,
      hersteller     = excluded.hersteller,
      modell         = excluded.modell,
      zustand        = excluded.zustand,
      preis_brutto   = excluded.preis_brutto,
      bestand        = excluded.bestand,
      gewicht_kg     = excluded.gewicht_kg,
      laenge_cm      = excluded.laenge_cm,
      breite_cm      = excluded.breite_cm,
      hoehe_cm       = excluded.hoehe_cm,
      aktiv          = excluded.aktiv,
      -- Bilder nur überschreiben, wenn der Lauf welche geholt hat. Sonst
      -- stünde ein markierter Artikel plötzlich ohne Foto da, bloß weil das
      -- Bildbudget dieses Abschnitts aufgebraucht war.
      bilder         = case when jsonb_array_length(excluded.bilder) > 0 then excluded.bilder else artikel.bilder end,
      gesehen_am     = now(),
      updated_at     = now()
  `
}

/** Merkt sich die zuletzt gelesene Seite. */
async function seiteMerken(seite: number | null): Promise<void> {
  await sql`
    insert into settings (key, value, updated_at)
    values (${SEITE_SCHLUESSEL}, ${sql.json((seite ?? 1) as never)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `
}

export async function naechsteSeite(): Promise<number> {
  const [zeile] = await sql<{ value: unknown }[]>`select value from settings where key = ${SEITE_SCHLUESSEL}`
  const wert = Number(zeile?.value ?? 1)
  return Number.isFinite(wert) && wert > 0 ? wert : 1
}

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

export async function abgleichLaufen(optionen: { vonVorn?: boolean } = {}): Promise<Syncbericht> {
  if (!plentyEingerichtet()) {
    throw new Error('PlentyONE ist nicht eingerichtet (PLENTY_BASE_URL / PLENTY_USER / PLENTY_PASSWORD).')
  }

  const diagnose: string[] = []
  const withParam = await handleWithAus(diagnose)
  const hersteller = await herstellerKarte(diagnose)
  const preislisteRoh = Number(process.env.PLENTY_SALES_PRICE_ID)
  const preislisteId = Number.isFinite(preislisteRoh) && preislisteRoh > 0 ? preislisteRoh : null
  diagnose.push(
    preislisteId ? `Preise aus Preisliste ${preislisteId}.` : 'Preise aus der kleinsten vorhandenen Preisliste.',
  )

  const start = optionen.vonVorn ? 1 : await naechsteSeite()
  let seite = start
  let gelesen = 0
  let gespeichert = 0
  let bilderGeholt = 0
  let gesamt: number | null = null
  let fertig = false

  for (let i = 0; i < SEITEN_JE_LAUF; i++) {
    const res = await plentyGet<PlentyListe<PlentyVariante>>(seitenPfad(seite, withParam))
    const eintraege = res?.entries ?? []
    if (typeof res?.totalsCount === 'number') gesamt = res.totalsCount

    for (const variante of eintraege) {
      gelesen++
      const daten = ausPlenty(variante, { hersteller, preislisteId })

      // Bilder kosten je Artikel einen eigenen Aufruf. Deshalb nur, wenn wir
      // noch keine haben oder der Artikel markiert ist — für alles andere
      // reicht, was beim nächsten Abschnitt nachkommt.
      let bilder: string[] | null = null
      if (daten.plenty_item_id != null && bilderGeholt < BILDER_JE_LAUF) {
        const [vorhanden] = await sql<{ anzahl: number; markiert: boolean }[]>`
          select jsonb_array_length(bilder) as anzahl, ms_markiert as markiert
            from artikel where plenty_variation_id = ${daten.plenty_variation_id}
        `
        if (!vorhanden || vorhanden.anzahl === 0 || vorhanden.markiert) {
          bilder = await bilderZu(daten.plenty_item_id)
          bilderGeholt++
        }
      }

      await speichern(daten, bilder)
      gespeichert++
    }

    const letzte = res?.isLastPage === true || eintraege.length === 0
    if (letzte) {
      fertig = true
      break
    }
    seite++
  }

  // Nach dem letzten Abschnitt wieder von vorn: Preise und Bestände ändern
  // sich, ein einmaliger Durchlauf wäre eine Momentaufnahme.
  const weiter = fertig ? 1 : seite
  await seiteMerken(weiter)

  return {
    vonSeite: start,
    bisSeite: fertig ? seite : seite - 1,
    naechsteSeite: fertig ? null : weiter,
    fertig,
    gelesen,
    gespeichert,
    bilderGeholt,
    gesamtLautPlenty: gesamt,
    diagnose,
  }
}
