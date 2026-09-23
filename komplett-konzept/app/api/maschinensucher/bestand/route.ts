import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { bestandAbgleichen } from '@/lib/plenty/bestand'
import { laufMelden } from '@/lib/maschinensucher/lauf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST → Bestände abgleichen.
 *
 * Der Lauf, der Artikel vom Marktplatz nimmt: Was keinen Bestand mehr hat,
 * fällt aus der Importdatei, und Maschinensucher nimmt das Inserat beim
 * nächsten Abgleich herunter.
 *
 * Bewusst getrennt vom Artikelabgleich und öfter — Bestände sind billig zu
 * lesen, Texte und Bilder nicht.
 *
 *   POST /api/maschinensucher/bestand
 *   Authorization: Bearer <INGEST_TOKEN>
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

  const beginn = new Date()
  try {
    const bericht = await bestandAbgleichen()
    await laufMelden({
      key: 'maschinensucher-bestand',
      status: 'success',
      trigger: 'schedule',
      startedAt: beginn,
      itemsProcessed: bericht.aktualisiert,
      output: {
        gelesen: bericht.gelesen,
        varianten: bericht.varianten,
        aufNull: bericht.aufNull,
        vollstaendig: bericht.vollstaendig,
        seiten: bericht.seiten,
      },
      logs: [
        {
          level: 'info',
          message:
            `${bericht.varianten} Varianten mit Bestand gelesen, ${bericht.aktualisiert} Artikel aktualisiert.` +
            (bericht.aufNull > 0
              ? ` ${bericht.aufNull} markierte Artikel stehen jetzt auf 0 und fallen aus der Importdatei.`
              : ''),
        },
        ...bericht.hinweise.map((h) => ({ level: 'warn' as const, message: h })),
      ],
      // Ein zurückgehaltener Lauf ist kein Fehler des Laufs, gehört aber ins
      // Fehlerfach: Solange die Sicherung greift, altert der Bestand.
      fehler:
        bericht.hinweise.length > 0
          ? { message: bericht.hinweise.join(' '), code: 'BESTAND', severity: 'warning' }
          : undefined,
    })
    return NextResponse.json({ ok: true, bericht })
  } catch (e) {
    const meldung = e instanceof Error ? e.message : String(e)
    await laufMelden({
      key: 'maschinensucher-bestand',
      status: 'failed',
      trigger: 'schedule',
      startedAt: beginn,
      fehler: { message: meldung, code: 'PLENTY' },
    })
    return NextResponse.json({ ok: false, fehler: meldung }, { status: 502 })
  }
}
