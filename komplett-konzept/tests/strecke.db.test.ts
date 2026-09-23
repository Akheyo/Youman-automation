/**
 * Die Maschinensucher-Strecke gegen eine ECHTE Datenbank.
 *
 * Der Compiler prüft, ob SQL-Zeichenketten zusammengebaut werden können —
 * nicht, ob sie Postgres versteht. Genau da sitzen die Fehler, die erst
 * nachts auffallen: ein Feld, das es nicht gibt, ein Umwandlungsfehler bei
 * uuid[], ein Konflikt, der nicht greift.
 *
 * Ohne DATABASE_URL wird der Block übersprungen, damit `npm test` überall
 * läuft. Mit Datenbank (lokal genügt ein leeres Postgres, Migrationen über
 * `npm run db:migrate`) geht er die ganze Strecke durch:
 *
 *   Artikel anlegen → Markierung aus Plenty → Datei bauen → Stand nachführen →
 *   Lauf melden → Rückgang prüfen
 *
 * Die Markierung setzt hier die SQL-Zeile so, wie der Abgleich sie schreibt
 * (siehe sync.db.test.ts, wo sie aus einem nachgebauten Plenty kommt).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from '@/lib/db'
import {
  artikelZaehlen,
  kandidaten,
  kategorieSetzen,
  markierteArtikel,
  standNachAbholung,
  teileAuf,
} from '@/lib/maschinensucher/artikel'
import { freigabeSetzen, freigabeStand, laufMelden, letzteAbholungMenge, letzteLaeufe } from '@/lib/maschinensucher/lauf'
import { baueCsv } from '@/lib/maschinensucher/csv'
import { standardPlan } from '@/lib/maschinensucher/felder'
import { pruefeRueckgang } from '@/lib/maschinensucher/rueckgang'
import type { Umgebung } from '@/lib/maschinensucher/inserat'

const MIT_DB = Boolean(process.env.DATABASE_URL)

const UMGEBUNG: Umgebung = {
  nummernPraefix: 'KK-',
  preisIst: 'brutto',
  mwst: 19,
  land: 'DE',
  plz: '70565',
  ort: 'Stuttgart',
  ansprechpartner: 'Verkauf',
  telefon: '0711 000',
  email: 'maschinensucher@komplett-konzept.de',
  kategorieStandard: '9999',
  kategorieZuordnung: [],
  shopBasisUrl: 'https://shop.example.de',
  veraltetNachTagen: 3,
  bestandAltNachStunden: 24,
}

// Varianten-IDs, die es in keinem echten Stamm gibt — damit der Test auch an
// einer Datenbank mit Daten nichts anfasst, was ihm nicht gehört.
const VOLLSTAENDIG = 999_000_001
const OHNE_PREIS = 999_000_002

describe.skipIf(!MIT_DB)('Maschinensucher-Strecke gegen Postgres', () => {
  beforeAll(async () => {
    await sql`delete from artikel where plenty_variation_id in (${VOLLSTAENDIG}, ${OHNE_PREIS})`
    await sql`
      insert into artikel (plenty_variation_id, plenty_item_id, nummer, titel, beschreibung,
                           hersteller, preis_brutto, bestand, aktiv, bilder, gesehen_am)
      values
        (${VOLLSTAENDIG}, 1, 'TEST-1', 'Testmaschine', '<p>Gut erhalten.</p>', 'Weiler',
         2261.00, 1, true, ${sql.json(['https://cdn.example/1.jpg'] as never)}, now()),
        (${OHNE_PREIS}, 2, 'TEST-2', 'Testmaschine ohne Preis', '<p>Text.</p>', 'Weiler',
         null, 1, true, ${sql.json(['https://cdn.example/2.jpg'] as never)}, now())
    `
  })

  afterAll(async () => {
    await sql`delete from artikel where plenty_variation_id in (${VOLLSTAENDIG}, ${OHNE_PREIS})`
    await sql.end({ timeout: 5 })
  })

  async function idVon(variationId: number): Promise<string> {
    const [zeile] = await sql<{ id: string }[]>`
      select id::text from artikel where plenty_variation_id = ${variationId}
    `
    return zeile.id
  }

  it('findet neue Artikel als Kandidaten und zaehlt sie', async () => {
    const treffer = await kandidaten('Testmaschine', 10)
    expect(treffer.length).toBeGreaterThanOrEqual(2)
    expect((await artikelZaehlen()).gesamt).toBeGreaterThanOrEqual(2)
  })

  it('nimmt die Markierung, die der Abgleich aus Plenty geschrieben hat', async () => {
    await sql`
      update artikel
         set ms_markiert = true, ms_markiert_am = now(), ms_markiert_von = 'Plenty-Markierung 27',
             plenty_flag_one = 27
       where plenty_variation_id in (${VOLLSTAENDIG}, ${OHNE_PREIS})
    `

    const markierte = await markierteArtikel()
    const unsere = markierte.filter((m) => [VOLLSTAENDIG, OHNE_PREIS].includes(Number(m.plenty_variation_id)))
    expect(unsere).toHaveLength(2)
    expect(unsere.every((m) => m.plenty_flag_one === 27)).toBe(true)
  })

  it('trennt vollstaendig von unvollstaendig und baut daraus die Datei', async () => {
    const markierte = (await markierteArtikel()).filter((m) =>
      [VOLLSTAENDIG, OHNE_PREIS].includes(Number(m.plenty_variation_id)),
    )
    const { bereit, zurueck } = teileAuf(markierte, UMGEBUNG)

    expect(bereit.map((b) => Number(b.zeile.plenty_variation_id))).toEqual([VOLLSTAENDIG])
    expect(zurueck).toHaveLength(1)
    expect(zurueck[0].inserat.maengel.join(' ')).toContain('Kein Preis')

    const csv = baueCsv(bereit.map((b) => b.inserat.werte), standardPlan())
    const zeilen = csv.trim().split('\r\n')
    expect(zeilen).toHaveLength(2) // Kopfzeile + ein Inserat
    expect(zeilen[1]).toContain('1900,00') // 2261 brutto → netto
  })

  it('fuehrt den Stand nach: abgeholt hier, Grund dort', async () => {
    const id = await idVon(VOLLSTAENDIG)
    const idOhne = await idVon(OHNE_PREIS)

    await standNachAbholung([{ id, werte: { titel: 'Testmaschine', preis: '1900,00' } }], [
      { id: idOhne, grund: 'Kein Preis — ohne Preis kein Inserat.' },
    ])

    const [drin] = await sql<{ ms_abgeholt_am: Date | null; ms_inserat: Record<string, string> | null }[]>`
      select ms_abgeholt_am, ms_inserat from artikel where id = ${id}::uuid
    `
    expect(drin.ms_abgeholt_am).not.toBeNull()
    expect(drin.ms_inserat?.preis).toBe('1900,00')

    const [zurueck] = await sql<{ ms_fehler: string | null }[]>`
      select ms_fehler from artikel where id = ${idOhne}::uuid
    `
    expect(zurueck.ms_fehler).toContain('Kein Preis')
  })

  it('meldet einen Lauf, und die Notbremse rechnet damit', async () => {
    const id = await laufMelden({
      key: 'maschinensucher-abholung',
      status: 'success',
      startedAt: new Date(Date.now() - 1200),
      itemsProcessed: 200,
      output: { inserate: 200 },
      logs: [{ level: 'info', message: 'Testlauf.' }],
    })
    expect(id).not.toBeNull()

    expect(await letzteAbholungMenge()).toBe(200)
    expect((await letzteLaeufe('maschinensucher-abholung', 1))[0].items_processed).toBe(200)

    // Ein Einbruch von 200 auf 1 wird zurueckgehalten …
    const befund = pruefeRueckgang({ jetzt: 1, zuletzt: 200, freiBis: null, zeitpunkt: new Date() })
    expect(befund.blockiert).toBe(true)

    // … bis ihn jemand freigibt.
    const bis = new Date(Date.now() + 3600_000).toISOString()
    await freigabeSetzen(bis)
    expect(await freigabeStand()).toBe(bis)
    expect(pruefeRueckgang({ jetzt: 1, zuletzt: 200, freiBis: await freigabeStand(), zeitpunkt: new Date() }).blockiert).toBe(
      false,
    )

    await sql`delete from executions where id = ${id}::uuid`
    await sql`delete from settings where key = 'maschinensucher.rueckgang_frei_bis'`
  })

  it('setzt die Rubrik von Hand — das ist unsere Angabe, nicht Plentys', async () => {
    const id = await idVon(VOLLSTAENDIG)
    await kategorieSetzen(id, '1234')

    const [mit] = await sql<{ kategorie: string | null }[]>`select kategorie from artikel where id = ${id}::uuid`
    expect(mit.kategorie).toBe('1234')

    await kategorieSetzen(id, '  ')
    const [ohne] = await sql<{ kategorie: string | null }[]>`select kategorie from artikel where id = ${id}::uuid`
    expect(ohne.kategorie).toBeNull()
  })
})
