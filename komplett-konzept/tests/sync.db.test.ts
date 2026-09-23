/**
 * Der Plenty-Abgleich gegen eine echte Datenbank und ein nachgebautes Plenty.
 *
 * Plenty selbst steht im Test nicht zur Verfügung — also läuft hier ein
 * kleiner Server, der antwortet wie die dokumentierten Endpunkte. Das prüft
 * genau die Stellen, an denen es in Wirklichkeit klemmt: das Aushandeln des
 * „with"-Parameters, das Blättern, das Bildbudget und der Upsert, der die
 * Markierung NICHT anfassen darf.
 *
 * Ohne DATABASE_URL wird übersprungen (siehe strecke.db.test.ts).
 */

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@/lib/db'

const MIT_DB = Boolean(process.env.DATABASE_URL)

const VARIANTE_A = 999_100_001
const VARIANTE_B = 999_100_002

/** Was das nachgebaute Plenty gerade antwortet. */
const zustand = {
  /** Markierung 1 am ersten Artikel — 27 heißt „Maschinensucher". */
  flagOne: 27 as number | null,
  /** Wie eine ältere Ausbaustufe: gar keine Artikeldaten mitliefern. */
  ohneItem: false,
}

/** Ein Plenty, das nur das kann, was wir lesen. */
function nachbau(): Promise<{ server: Server; basis: string; aufrufe: string[] }> {
  const aufrufe: string[] = []

  const server = createServer((req, res) => {
    const pfad = req.url ?? ''
    aufrufe.push(pfad)
    const antworte = (koerper: unknown) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(koerper))
    }

    if (pfad.startsWith('/rest/login')) return antworte({ access_token: 'test-token', expires_in: 3600 })

    if (pfad.startsWith('/rest/items/manufacturers')) {
      return antworte({ entries: [{ id: 7, name: 'Weiler' }] })
    }

    if (/\/rest\/items\/\d+\/images/.test(pfad)) {
      return antworte([
        { url: 'https://cdn.example/gross-2.jpg', position: 2 },
        { url: 'https://cdn.example/gross-1.jpg', position: 1 },
      ])
    }

    if (pfad.startsWith('/rest/items/variations')) {
      // Die reichste "with"-Fassung lehnen wir ab — so wie eine ältere
      // Plenty-Ausbaustufe es täte. Der Abgleich muss weiterprobieren.
      if (pfad.includes('with=item,variationSalesPrices,variationBarcodes,stock')) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end('{"error":"unknown with"}')
      }
      // Eine Ausbaustufe, die Artikeldaten gar nicht kennt: Dann sind auch
      // die Markierungen nicht lesbar.
      if (zustand.ohneItem && pfad.includes('with=')) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end('{"error":"unknown with"}')
      }
      const seite = Number(new URL(pfad, 'http://x').searchParams.get('page') ?? 1)
      if (seite > 1) return antworte({ entries: [], page: seite, isLastPage: true })
      return antworte({
        page: 1,
        isLastPage: true,
        totalsCount: 2,
        entries: [
          {
            id: VARIANTE_A,
            itemId: 4711,
            number: 'SYNC-A',
            model: 'Praktikant',
            isActive: true,
            weightG: 850_000,
            lengthMM: 1800,
            variationBarcodes: [{ code: '2000000047119' }],
            variationSalesPrices: [{ salesPriceId: 1, price: 2261 }],
            item: {
              id: 4711,
              manufacturerId: 7,
              condition: 1,
              flagOne: zustand.flagOne,
              texts: [{ lang: 'de', name1: 'Weiler Drehmaschine', description: '<p>Gut.</p>' }],
            },
          },
          {
            id: VARIANTE_B,
            itemId: 4712,
            number: 'SYNC-B',
            isActive: false,
            variationSalesPrices: [],
            item: { id: 4712, texts: [{ lang: 'de', name1: 'Zweite Maschine' }] },
          },
        ],
      })
    }

    res.writeHead(404)
    res.end('nicht gefunden')
  })

  return new Promise((fertig) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      fertig({ server, basis: `http://127.0.0.1:${port}`, aufrufe })
    })
  })
}

describe.skipIf(!MIT_DB)('Plenty-Abgleich', () => {
  let server: Server
  let aufrufe: string[]

  beforeAll(async () => {
    const n = await nachbau()
    server = n.server
    aufrufe = n.aufrufe
    process.env.PLENTY_BASE_URL = n.basis
    process.env.PLENTY_USER = 'test'
    process.env.PLENTY_PASSWORD = 'test'
    await sql`delete from artikel where plenty_variation_id in (${VARIANTE_A}, ${VARIANTE_B})`
    await sql`delete from settings where key = 'maschinensucher.sync_seite'`
  })

  afterAll(async () => {
    await sql`delete from artikel where plenty_variation_id in (${VARIANTE_A}, ${VARIANTE_B})`
    await sql`delete from settings where key = 'maschinensucher.sync_seite'`
    await sql.end({ timeout: 5 })
    server.close()
  })

  it('handelt den with-Parameter aus, statt ihn zu raten', async () => {
    const { abgleichLaufen } = await import('@/lib/plenty/sync')
    const bericht = await abgleichLaufen({ vonVorn: true })

    expect(bericht.diagnose.join(' ')).toContain('wird nicht unterstützt')
    expect(bericht.gespeichert).toBe(2)
    expect(bericht.fertig).toBe(true)
    // Nach dem letzten Abschnitt beginnt der nächste Lauf wieder vorn.
    expect(bericht.naechsteSeite).toBeNull()
  })

  it('schreibt die Artikel mit umgerechneten Einheiten in die Datenbank', async () => {
    const [a] = await sql<
      { titel: string; hersteller: string; gewicht_kg: string; laenge_cm: string; preis_brutto: string; bilder: string[]; aktiv: boolean }[]
    >`
      select titel, hersteller, gewicht_kg, laenge_cm, preis_brutto, bilder, aktiv
        from artikel where plenty_variation_id = ${VARIANTE_A}
    `
    expect(a.titel).toBe('Weiler Drehmaschine')
    expect(a.hersteller).toBe('Weiler')
    expect(Number(a.gewicht_kg)).toBe(850)
    expect(Number(a.laenge_cm)).toBe(180)
    expect(Number(a.preis_brutto)).toBe(2261)
    expect(a.aktiv).toBe(true)
    // Bilder in der Reihenfolge ihrer Position, nicht in der der Antwort.
    expect(a.bilder).toEqual(['https://cdn.example/gross-1.jpg', 'https://cdn.example/gross-2.jpg'])

    const [b] = await sql<{ aktiv: boolean; preis_brutto: string | null }[]>`
      select aktiv, preis_brutto from artikel where plenty_variation_id = ${VARIANTE_B}
    `
    expect(b.aktiv).toBe(false)
    expect(b.preis_brutto).toBeNull()
  })

  it('markiert, was in Plenty die Markierung 27 traegt — und nur das', async () => {
    const [a] = await sql<{ ms_markiert: boolean; ms_markiert_von: string; plenty_flag_one: number; ms_markiert_am: Date }[]>`
      select ms_markiert, ms_markiert_von, plenty_flag_one, ms_markiert_am
        from artikel where plenty_variation_id = ${VARIANTE_A}
    `
    expect(a.ms_markiert).toBe(true)
    expect(a.plenty_flag_one).toBe(27)
    expect(a.ms_markiert_von).toContain('27')

    const [b] = await sql<{ ms_markiert: boolean }[]>`
      select ms_markiert from artikel where plenty_variation_id = ${VARIANTE_B}
    `
    expect(b.ms_markiert).toBe(false)
  })

  it('setzt den Zeitstempel nur beim Wechsel, nicht bei jedem Lauf', async () => {
    const [vorher] = await sql<{ ms_markiert_am: Date }[]>`
      select ms_markiert_am from artikel where plenty_variation_id = ${VARIANTE_A}
    `
    const { abgleichLaufen } = await import('@/lib/plenty/sync')
    await abgleichLaufen({ vonVorn: true })

    const [nachher] = await sql<{ ms_markiert_am: Date }[]>`
      select ms_markiert_am from artikel where plenty_variation_id = ${VARIANTE_A}
    `
    // Sonst stuende nach jeder Nacht "gerade eben markiert" an jedem Artikel.
    expect(nachher.ms_markiert_am.getTime()).toBe(vorher.ms_markiert_am.getTime())
  })

  it('nimmt den Artikel herunter, wenn die Markierung in Plenty verschwindet', async () => {
    await sql`update artikel set kategorie = '1234' where plenty_variation_id = ${VARIANTE_A}`
    zustand.flagOne = null
    try {
      const { abgleichLaufen } = await import('@/lib/plenty/sync')
      await abgleichLaufen({ vonVorn: true })

      const [a] = await sql<{ ms_markiert: boolean; ms_markiert_am: Date | null; kategorie: string }[]>`
        select ms_markiert, ms_markiert_am, kategorie
          from artikel where plenty_variation_id = ${VARIANTE_A}
      `
      expect(a.ms_markiert).toBe(false)
      expect(a.ms_markiert_am).toBeNull()
      // Die Rubrik ist unsere Angabe — die faellt dabei nicht mit weg.
      expect(a.kategorie).toBe('1234')
    } finally {
      zustand.flagOne = 27
    }
  })

  it('laesst die Markierungen in Ruhe, wenn Plenty keine Artikeldaten liefert', async () => {
    // Der gefaehrlichste Fall der ganzen Strecke: Ein Lauf, der die
    // Markierungen nicht lesen kann, duerfte sie nicht alle loeschen — sonst
    // raeumt eine Nacht den ganzen Marktplatz leer.
    const { abgleichLaufen: mitItem } = await import('@/lib/plenty/sync')
    await mitItem({ vonVorn: true })
    const [vorher] = await sql<{ ms_markiert: boolean }[]>`
      select ms_markiert from artikel where plenty_variation_id = ${VARIANTE_A}
    `
    expect(vorher.ms_markiert).toBe(true)

    zustand.ohneItem = true
    vi.resetModules() // damit das ausgehandelte "with" neu bestimmt wird
    try {
      const { abgleichLaufen } = await import('@/lib/plenty/sync')
      const bericht = await abgleichLaufen({ vonVorn: true })

      expect(bericht.markierungLesbar).toBe(false)
      expect(bericht.diagnose.join(' ')).toContain('Markierungen bleiben unverändert')

      const [a] = await sql<{ ms_markiert: boolean; plenty_flag_one: number | null }[]>`
        select ms_markiert, plenty_flag_one from artikel where plenty_variation_id = ${VARIANTE_A}
      `
      expect(a.ms_markiert).toBe(true)
      expect(a.plenty_flag_one).toBe(27)
    } finally {
      zustand.ohneItem = false
      vi.resetModules()
    }
  })
})
