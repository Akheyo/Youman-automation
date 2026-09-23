/**
 * Der Bestandsabgleich gegen eine echte Datenbank und ein nachgebautes Plenty.
 *
 * Geprüft wird das, was den Marktplatz leert: Ein Artikel ohne Bestandszeile
 * fällt auf 0 und damit aus der Importdatei. Und die Gegenprobe, die
 * wichtiger ist als der Normalfall — dass ein abgebrochener oder
 * unvollständiger Lauf eben NICHT alles auf 0 setzt.
 *
 * Ohne DATABASE_URL wird übersprungen (siehe strecke.db.test.ts).
 */

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@/lib/db'
import { baueInserat } from '@/lib/maschinensucher/inserat'
import { markierteArtikel } from '@/lib/maschinensucher/artikel'
import { umgebung } from '@/lib/maschinensucher/zugang'

const MIT_DB = Boolean(process.env.DATABASE_URL)

const MIT_BESTAND = 999_300_001
const VERKAUFT = 999_300_002
const UNSERE = [MIT_BESTAND, VERKAUFT]

/** Was das nachgebaute Plenty an Bestandszeilen ausgibt. */
const zustand = {
  zeilen: [] as Array<{ variationId: number; warehouseId: number; netStock: number }>,
  /** Antwortet nie mit isLastPage — der Lauf bricht dann am Seitenlimit ab. */
  endlos: false,
}

function nachbau(): Promise<{ server: Server; basis: string }> {
  const server = createServer((req, res) => {
    const pfad = req.url ?? ''
    const antworte = (koerper: unknown) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(koerper))
    }

    if (pfad.startsWith('/rest/login')) return antworte({ access_token: 'test', expires_in: 3600 })

    if (pfad.startsWith('/rest/stockmanagement/stock')) {
      if (zustand.endlos) {
        // Immer dieselbe volle Seite: So verhält sich eine Instanz, die
        // "isLastPage" nicht setzt — der Lauf läuft ins Seitenlimit.
        return antworte({ entries: zustand.zeilen, isLastPage: false })
      }
      const seite = Number(new URL(pfad, 'http://x').searchParams.get('page') ?? 1)
      if (seite > 1) return antworte({ entries: [], isLastPage: true })
      return antworte({ entries: zustand.zeilen, isLastPage: true })
    }

    res.writeHead(404)
    res.end('nicht gefunden')
  })

  return new Promise((fertig) => {
    server.listen(0, '127.0.0.1', () => {
      fertig({ server, basis: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })
    })
  })
}

async function artikelAnlegen(variationId: number, bestand: number, markiert = true) {
  await sql`
    insert into artikel (plenty_variation_id, plenty_item_id, nummer, titel, beschreibung, hersteller,
                         preis_brutto, bestand, bestand_am, aktiv, bilder, gesehen_am,
                         ms_markiert, ms_markiert_am, ms_markiert_von, plenty_flag_one)
    values (${variationId}, 1, ${'BST-' + variationId}, 'Bestandstest', '<p>Text.</p>', 'Weiler',
            2261.00, ${bestand}, now() - interval '2 days', true,
            ${sql.json(['https://cdn.example/1.jpg'] as never)}, now(),
            ${markiert}, ${markiert ? sql`now()` : sql`null`}, 'Plenty-Markierung 27', ${markiert ? 27 : null})
    on conflict (plenty_variation_id) do update set bestand = excluded.bestand,
      bestand_am = excluded.bestand_am, ms_markiert = excluded.ms_markiert
  `
}

describe.skipIf(!MIT_DB)('Bestandsabgleich', () => {
  let server: Server

  beforeAll(async () => {
    const n = await nachbau()
    server = n.server
    process.env.PLENTY_BASE_URL = n.basis
    process.env.PLENTY_USER = 'test'
    process.env.PLENTY_PASSWORD = 'test'
    // Damit das Inserat nur noch am Bestand scheitern kann und nicht an der
    // Einrichtung.
    process.env.MASCHINENSUCHER_KATEGORIE = '9999'
    process.env.MASCHINENSUCHER_PLZ = '70565'
    process.env.MASCHINENSUCHER_ORT = 'Stuttgart'
    process.env.MASCHINENSUCHER_EMAIL = 'maschinensucher@komplett-konzept.de'
  })

  afterEach(async () => {
    await sql`delete from artikel where plenty_variation_id >= 999_300_000 and plenty_variation_id < 999_400_000`
    zustand.endlos = false
  })

  afterAll(async () => {
    await sql.end({ timeout: 5 })
    server.close()
  })

  it('schreibt den Bestand und merkt sich, wann er geprueft wurde', async () => {
    await artikelAnlegen(MIT_BESTAND, 1)
    await artikelAnlegen(VERKAUFT, 1)
    zustand.zeilen = [
      { variationId: MIT_BESTAND, warehouseId: 1, netStock: 2 },
      { variationId: MIT_BESTAND, warehouseId: 2, netStock: 1 },
      { variationId: VERKAUFT, warehouseId: 1, netStock: 1 },
    ]

    const { bestandAbgleichen } = await import('@/lib/plenty/bestand')
    const bericht = await bestandAbgleichen()
    expect(bericht.vollstaendig).toBe(true)
    expect(bericht.varianten).toBe(2)

    const [a] = await sql<{ bestand: number; bestand_am: Date }[]>`
      select bestand, bestand_am from artikel where plenty_variation_id = ${MIT_BESTAND}
    `
    // Über beide Lager zusammengezählt.
    expect(a.bestand).toBe(3)
    expect(Date.now() - a.bestand_am.getTime()).toBeLessThan(60_000)
  })

  it('setzt auf 0, was keine Bestandszeile mehr hat — und nimmt es damit vom Markt', async () => {
    await artikelAnlegen(MIT_BESTAND, 3)
    await artikelAnlegen(VERKAUFT, 1)
    // Das verkaufte Gerät taucht in Plenty nicht mehr auf.
    zustand.zeilen = [{ variationId: MIT_BESTAND, warehouseId: 1, netStock: 3 }]

    const { bestandAbgleichen } = await import('@/lib/plenty/bestand')
    const bericht = await bestandAbgleichen()
    expect(bericht.aufNull).toBe(1)

    const [weg] = await sql<{ bestand: number }[]>`
      select bestand from artikel where plenty_variation_id = ${VERKAUFT}
    `
    expect(weg.bestand).toBe(0)

    // Und damit fällt es aus der Datei: Das ist das Herunternehmen.
    const markierte = await markierteArtikel()
    const zeile = markierte.find((m) => Number(m.plenty_variation_id) === VERKAUFT)!
    const inserat = baueInserat(zeile, umgebung())
    expect(inserat.maengel.join(' ')).toContain('Kein Bestand')

    const geblieben = markierte.find((m) => Number(m.plenty_variation_id) === MIT_BESTAND)!
    expect(baueInserat(geblieben, umgebung()).maengel).toEqual([])
  })

  it('setzt nach einem abgebrochenen Lauf nichts auf 0', async () => {
    await artikelAnlegen(MIT_BESTAND, 3)
    await artikelAnlegen(VERKAUFT, 1)
    zustand.zeilen = [{ variationId: MIT_BESTAND, warehouseId: 1, netStock: 3 }]
    zustand.endlos = true

    process.env.PLENTY_BESTAND_SEITEN = '2'
    vi.resetModules()
    try {
      const { bestandAbgleichen } = await import('@/lib/plenty/bestand')
      const bericht = await bestandAbgleichen()

      expect(bericht.vollstaendig).toBe(false)
      expect(bericht.aufNull).toBe(0)
      expect(bericht.hinweise.join(' ')).toContain('nicht durchgelaufen')

      // Ein halb gelesener Bestand sieht aus wie ein leeres Lager — der
      // Artikel bleibt deshalb stehen.
      const [unberuehrt] = await sql<{ bestand: number }[]>`
        select bestand from artikel where plenty_variation_id = ${VERKAUFT}
      `
      expect(unberuehrt.bestand).toBe(1)
    } finally {
      delete process.env.PLENTY_BESTAND_SEITEN
      vi.resetModules()
    }
  })

  it('haelt einen Einbruch zurueck, statt den halben Marktplatz zu leeren', async () => {
    for (let i = 0; i < 10; i++) await artikelAnlegen(999_300_010 + i, 1)
    // Plenty meldet auf einmal gar keinen Bestand mehr — fast immer ein
    // fehlendes Lagerrecht, kein Verkaufstag.
    zustand.zeilen = []

    const { bestandAbgleichen } = await import('@/lib/plenty/bestand')
    const bericht = await bestandAbgleichen()

    expect(bericht.aufNull).toBe(0)
    expect(bericht.hinweise.join(' ')).toContain('markierten Artikeln')

    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from artikel
       where plenty_variation_id between 999_300_010 and 999_300_019 and bestand = 1
    `
    expect(n).toBe(10)
  })
})
