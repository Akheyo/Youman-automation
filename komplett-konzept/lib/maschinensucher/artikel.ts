import 'server-only'

/**
 * Die Artikeldatenbank — lesen und Stand nachführen.
 *
 * Alle Abfragen der Maschinensucher-Strecke an einer Stelle, damit Oberfläche
 * und Importdatei dieselbe Antwort bekommen. Lägen sie getrennt, zeigte die
 * Oberfläche irgendwann etwas anderes, als tatsächlich hochgeht — und sie ist
 * die einzige Kontrolle, die wir über eine Datei haben, die sonst nur eine
 * Maschine liest.
 */

import { sql } from '@/lib/db'
import { baueInserat, type Artikel, type Inserat, type Umgebung } from './inserat'

/** Die Spalten, aus denen ein Inserat entsteht — plus der Stand der Markierung. */
export interface ArtikelZeile extends Artikel {
  ms_markiert: boolean
  ms_markiert_am: Date | null
  /** Woher die Markierung kommt — seit dem Umstieg: die Markierung in Plenty. */
  ms_markiert_von: string | null
  plenty_flag_one: number | null
  plenty_flag_two: number | null
  ms_abgeholt_am: Date | null
  ms_fehler: string | null
  ms_inserat: Record<string, string> | null
}

/**
 * Die Spaltenliste als FUNKTION, nicht als Konstante.
 *
 * `sql\`...\`` auf Modulebene baut die Datenbankverbindung schon beim Import
 * auf — und Next.js lädt die Module beim Bauen, wo es keine Datenbank gibt.
 * Der Build bricht dann mit „DATABASE_URL ist nicht gesetzt" ab, ohne dass
 * jemand etwas abgefragt hätte.
 */
function felder() {
  return sql`
    id::text, plenty_variation_id, plenty_item_id, nummer, ean, titel, beschreibung,
    hersteller, modell, baujahr, zustand, preis_brutto, waehrung, bestand, bestand_am,
    gewicht_kg, laenge_cm, breite_cm, hoehe_cm, bilder, kategorie, aktiv, gesehen_am,
    plenty_flag_one, plenty_flag_two,
    ms_markiert, ms_markiert_am, ms_markiert_von, ms_abgeholt_am, ms_fehler, ms_inserat
  `
}

/** Die markierten Artikel, neueste Markierung zuerst. */
export async function markierteArtikel(limit = 1000): Promise<ArtikelZeile[]> {
  return sql<ArtikelZeile[]>`
    select ${felder()} from artikel
     where ms_markiert
     order by ms_markiert_am desc nulls last
     limit ${limit}
  `
}

/**
 * Artikel ohne die Maschinensucher-Markierung.
 *
 * Mit Suchbegriff, weil der Stamm aus Plenty groß ist: Wer wissen will, warum
 * ein bestimmtes Gerät nicht draußen steht, sucht es — und sieht an der Zeile,
 * ob die Markierung fehlt oder etwas anderes.
 */
export async function kandidaten(suche = '', limit = 50): Promise<ArtikelZeile[]> {
  const begriff = suche.trim()
  if (!begriff) {
    return sql<ArtikelZeile[]>`
      select ${felder()} from artikel
       where not ms_markiert and coalesce(aktiv, true) and coalesce(bestand, 1) > 0
       order by gesehen_am desc nulls last
       limit ${limit}
    `
  }
  const muster = `%${begriff}%`
  return sql<ArtikelZeile[]>`
    select ${felder()} from artikel
     where not ms_markiert
       and (titel ilike ${muster} or hersteller ilike ${muster} or modell ilike ${muster}
            or nummer ilike ${muster} or ean ilike ${muster})
     order by gesehen_am desc nulls last
     limit ${limit}
  `
}

export async function artikelZaehlen(): Promise<{ gesamt: number; markiert: number; draussen: number }> {
  const [zeile] = await sql<{ gesamt: string; markiert: string; draussen: string }[]>`
    select count(*)                                              as gesamt,
           count(*) filter (where ms_markiert)                   as markiert,
           count(*) filter (where ms_markiert and ms_abgeholt_am is not null) as draussen
      from artikel
  `
  return {
    gesamt: Number(zeile?.gesamt ?? 0),
    markiert: Number(zeile?.markiert ?? 0),
    draussen: Number(zeile?.draussen ?? 0),
  }
}

/** Die Kategorie eines Artikels von Hand setzen (oder wieder leeren). */
export async function kategorieSetzen(id: string, kategorie: string): Promise<void> {
  const wert = kategorie.trim()
  await sql`
    update artikel set kategorie = ${wert || null}, updated_at = now()
     where id = ${id}::uuid
  `
}

/**
 * Nach einer Abholung: festhalten, was wirklich in der Datei stand.
 *
 * Der Zeitstempel bedeutet „war in der abgeholten Datei" — nicht „wurde
 * einmal betrachtet". Erst er heißt, dass ein Artikel draußen ist.
 */
export async function standNachAbholung(
  drin: Array<{ id: string; werte: Record<string, string> }>,
  zurueck: Array<{ id: string; grund: string }>,
): Promise<void> {
  if (drin.length > 0) {
    await sql`
      update artikel set ms_abgeholt_am = now(), ms_fehler = null
       where id = any(${drin.map((d) => d.id)}::uuid[])
    `
    // Den Inhalt nur dort schreiben, wo er sich geändert hat — sonst wären es
    // bei jedem nächtlichen Lauf hunderte Schreibvorgänge ohne neue Information.
    for (const eintrag of drin) {
      await sql`
        update artikel set ms_inserat = ${sql.json(eintrag.werte as never)}
         where id = ${eintrag.id}::uuid
           and (ms_inserat is null or ms_inserat::text <> ${JSON.stringify(eintrag.werte)})
      `
    }
  }

  for (const eintrag of zurueck) {
    await sql`
      update artikel set ms_fehler = ${eintrag.grund}
       where id = ${eintrag.id}::uuid and coalesce(ms_fehler, '') <> ${eintrag.grund}
    `
  }
}

export interface Auswahl {
  /** Vollständige Inserate — genau das, was in der Datei landet. */
  bereit: Array<{ zeile: ArtikelZeile; inserat: Inserat }>
  /** Markiert, aber unvollständig. Gehen NICHT raus, mit Begründung. */
  zurueck: Array<{ zeile: ArtikelZeile; inserat: Inserat }>
}

/**
 * Trennt die markierten Artikel in „geht raus" und „fehlt noch etwas".
 *
 * Ein unvollständiges Inserat wird ÜBERSPRUNGEN, nicht halb hochgeladen. Ein
 * Gerät ohne Preis ist auf einem Marktplatz kein Platzhalter, sondern eine
 * Anfragefalle: Es kommen Anrufe zu etwas, zu dem wir nichts sagen können.
 */
export function teileAuf(zeilen: ArtikelZeile[], umgebung: Umgebung, jetzt = new Date()): Auswahl {
  const bereit: Auswahl['bereit'] = []
  const zurueck: Auswahl['zurueck'] = []
  for (const zeile of zeilen) {
    const inserat = baueInserat(zeile, umgebung, jetzt)
    ;(inserat.maengel.length === 0 ? bereit : zurueck).push({ zeile, inserat })
  }
  return { bereit, zurueck }
}
