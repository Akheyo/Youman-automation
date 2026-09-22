/**
 * Die Abholung selbst — der Endpunkt, den Maschinensucher nachts aufruft.
 *
 * Hier wird die Route aufgerufen wie von außen: mit und ohne Token, mit
 * fehlender Pflichtspalte, mit Einbruch. Genau diese vier Fälle entscheiden,
 * ob nachts der Bestand online steht oder verschwindet — und keiner von
 * ihnen fällt beim Kompilieren auf.
 *
 * Ohne DATABASE_URL wird übersprungen (siehe strecke.db.test.ts).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { sql } from '@/lib/db'

const MIT_DB = Boolean(process.env.DATABASE_URL)
const TOKEN = 'test-token-mit-genug-laenge'
const VARIANTE = 999_200_001

async function feedHolen(adresse: string, kopf: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/maschinensucher/feed/route')
  return GET(new Request(adresse, { headers: kopf }))
}

describe.skipIf(!MIT_DB)('Abholung durch Maschinensucher', () => {
  beforeAll(async () => {
    process.env.MASCHINENSUCHER_FEED_TOKEN = TOKEN
    process.env.MASCHINENSUCHER_KATEGORIE = '9999'
    process.env.MASCHINENSUCHER_PLZ = '70565'
    process.env.MASCHINENSUCHER_ORT = 'Stuttgart'
    process.env.MASCHINENSUCHER_EMAIL = 'maschinensucher@komplett-konzept.de'

    await sql`delete from artikel where plenty_variation_id = ${VARIANTE}`
    await sql`
      insert into artikel (plenty_variation_id, plenty_item_id, nummer, titel, beschreibung,
                           hersteller, preis_brutto, bestand, aktiv, bilder, gesehen_am,
                           ms_markiert, ms_markiert_am, ms_markiert_von)
      values (${VARIANTE}, 1, 'FEED-1', 'Abholtest', '<p>Gut erhalten.</p>', 'Weiler',
              2261.00, 1, true, ${sql.json(['https://cdn.example/1.jpg'] as never)}, now(),
              true, now(), 'Test')
    `
  })

  afterEach(async () => {
    // Die Läufe dieses Tests wieder entfernen, damit die Notbremse des
    // nächsten Falls mit bekannten Zahlen rechnet.
    await sql`
      delete from executions
       where automation_id = (select id from automations where key = 'maschinensucher-abholung')
    `
    await sql`delete from settings where key = 'maschinensucher.rueckgang_frei_bis'`
  })

  afterAll(async () => {
    await sql`delete from artikel where plenty_variation_id = ${VARIANTE}`
    await sql.end({ timeout: 5 })
  })

  it('weist einen Abruf ohne Token ab — und schreibt ihn trotzdem auf', async () => {
    const res = await feedHolen('https://dash.example/api/maschinensucher/feed')
    expect(res.status).toBe(401)

    const [lauf] = await sql<{ status: string; error_message: string }[]>`
      select e.status, e.error_message from executions e
        join automations a on a.id = e.automation_id
       where a.key = 'maschinensucher-abholung' order by e.started_at desc limit 1
    `
    // Ein falsches Token in der hinterlegten Adresse ist der wahrscheinlichste
    // Fehler dieser Strecke — und ohne diese Zeile unsichtbar.
    expect(lauf.status).toBe('failed')
    expect(lauf.error_message).toContain('Token')
  })

  it('liefert die Datei mit Token und fuehrt den Stand nach', async () => {
    const res = await feedHolen(`https://dash.example/api/maschinensucher/feed?token=${TOKEN}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')

    const text = await res.text()
    const zeilen = text.trim().split('\r\n')
    expect(zeilen[0]).toContain('Inseratsnummer')
    expect(zeilen.some((z) => z.includes('Abholtest') && z.includes('1900,00'))).toBe(true)

    const [artikel] = await sql<{ ms_abgeholt_am: Date | null }[]>`
      select ms_abgeholt_am from artikel where plenty_variation_id = ${VARIANTE}
    `
    expect(artikel.ms_abgeholt_am).not.toBeNull()

    const [lauf] = await sql<{ status: string; items_processed: number }[]>`
      select e.status, e.items_processed from executions e
        join automations a on a.id = e.automation_id
       where a.key = 'maschinensucher-abholung' order by e.started_at desc limit 1
    `
    expect(lauf.status).toBe('success')
    expect(lauf.items_processed).toBe(1)
  })

  it('nimmt das Token auch als Bearer und als HTTP-Basic', async () => {
    const bearer = await feedHolen('https://dash.example/api/maschinensucher/feed', {
      authorization: `Bearer ${TOKEN}`,
    })
    expect(bearer.status).toBe(200)

    const basic = Buffer.from(`maschinensucher:${TOKEN}`).toString('base64')
    const res = await feedHolen('https://dash.example/api/maschinensucher/feed', {
      authorization: `Basic ${basic}`,
    })
    expect(res.status).toBe(200)
  })

  it('liefert lieber nichts als eine Datei ohne Pflichtspalte', async () => {
    process.env.MASCHINENSUCHER_KOPFZEILE = 'Bezeichnung;Hersteller'
    try {
      const res = await feedHolen(`https://dash.example/api/maschinensucher/feed?token=${TOKEN}`)
      expect(res.status).toBe(500)
      expect(await res.text()).toContain('keine Spalte für')
    } finally {
      delete process.env.MASCHINENSUCHER_KOPFZEILE
    }
  })

  it('haelt einen Einbruch zurueck, bis er freigegeben ist', async () => {
    // Eine erfolgreiche Abholung mit 200 Inseraten vortäuschen …
    await sql`
      insert into executions (automation_id, status, trigger, items_processed, started_at, finished_at)
      values ((select id from automations where key = 'maschinensucher-abholung'),
              'success', 'webhook', 200, now() - interval '1 day', now() - interval '1 day')
    `

    // … jetzt steht nur noch eines drin: Das geht nicht raus.
    const gesperrt = await feedHolen(`https://dash.example/api/maschinensucher/feed?token=${TOKEN}`)
    expect(gesperrt.status).toBe(500)
    expect(await gesperrt.text()).toContain('Rückgang')

    // Nach der Freigabe schon.
    const { freigabeSetzen } = await import('@/lib/maschinensucher/lauf')
    await freigabeSetzen(new Date(Date.now() + 3600_000).toISOString())
    const frei = await feedHolen(`https://dash.example/api/maschinensucher/feed?token=${TOKEN}`)
    expect(frei.status).toBe(200)
  })
})
