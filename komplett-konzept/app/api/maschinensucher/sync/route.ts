import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { abgleichLaufen } from '@/lib/plenty/sync'
import { laufMelden } from '@/lib/maschinensucher/lauf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST → Einen Abschnitt des Plenty-Abgleichs laufen lassen.
 *
 * Hier hängt der Zeitplan dran: ein Cronjob, ein n8n-Knoten oder der Knopf im
 * Dashboard rufen diesen Endpunkt auf. Jeder Aufruf liest ein paar Seiten und
 * meldet sich als Lauf — wer öfter aufruft, ist schneller durch.
 *
 * Der Schlüssel ist derselbe wie für /api/ingest/execution (INGEST_TOKEN):
 * Automationen sollen sich mit EINEM Schlüssel ausweisen, nicht mit dreien.
 *
 *   POST /api/maschinensucher/sync
 *   Authorization: Bearer <INGEST_TOKEN>
 *   { "vonVorn": false }
 */

function tokenStimmt(kopf: string | null): boolean {
  const erwartet = process.env.INGEST_TOKEN
  if (!erwartet || erwartet.length < 16) return false
  const gegeben = kopf?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const a = Buffer.from(gegeben)
  const b = Buffer.from(erwartet)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!tokenStimmt(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, fehler: 'Zugang verweigert.' }, { status: 401 })
  }

  let vonVorn = false
  try {
    const koerper = (await request.json()) as { vonVorn?: unknown }
    vonVorn = koerper?.vonVorn === true
  } catch {
    // Kein Körper ist in Ordnung — dann läuft der Abgleich einfach weiter.
  }

  const beginn = new Date()
  try {
    const bericht = await abgleichLaufen({ vonVorn })
    await laufMelden({
      key: 'maschinensucher-sync',
      status: 'success',
      trigger: 'schedule',
      startedAt: beginn,
      itemsProcessed: bericht.gespeichert,
      input: { vonSeite: bericht.vonSeite, vonVorn },
      output: {
        bisSeite: bericht.bisSeite,
        naechsteSeite: bericht.naechsteSeite,
        fertig: bericht.fertig,
        gelesen: bericht.gelesen,
        bilderGeholt: bericht.bilderGeholt,
        gesamtLautPlenty: bericht.gesamtLautPlenty,
      },
      logs: [
        {
          level: 'info',
          message:
            `Seiten ${bericht.vonSeite}–${bericht.bisSeite}: ${bericht.gespeichert} Artikel geschrieben, ` +
            `${bericht.bilderGeholt} Bildabrufe.` +
            (bericht.fertig ? ' Der Stamm ist einmal durch — der nächste Lauf beginnt wieder vorn.' : ''),
        },
        ...bericht.diagnose.map((d) => ({ level: 'debug' as const, message: d })),
      ],
    })
    return NextResponse.json({ ok: true, bericht })
  } catch (e) {
    const meldung = e instanceof Error ? e.message : String(e)
    await laufMelden({
      key: 'maschinensucher-sync',
      status: 'failed',
      trigger: 'schedule',
      startedAt: beginn,
      input: { vonVorn },
      fehler: { message: meldung, code: 'PLENTY' },
    })
    return NextResponse.json({ ok: false, fehler: meldung }, { status: 502 })
  }
}
