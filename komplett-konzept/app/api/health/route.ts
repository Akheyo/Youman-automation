import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Einfacher Gesundheits-Endpunkt für Monitoring / Docker-Healthcheck.
export async function GET() {
  try {
    await sql`select 1`
    return NextResponse.json({ status: 'ok', zeit: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { status: 'fehler', meldung: err instanceof Error ? err.message : 'unbekannt' },
      { status: 503 },
    )
  }
}
