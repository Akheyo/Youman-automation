import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Anschlussstelle für Automationen.
 *
 * Jede Automation - n8n, Cronjob, Python-Skript - meldet ihre Läufe hierher,
 * statt selbst in die Datenbank zu schreiben. Damit braucht keine Automation
 * Datenbank-Zugangsdaten, und alle erscheinen im Dashboard auf dieselbe Weise.
 *
 *   POST /api/ingest/execution
 *   Authorization: Bearer <INGEST_TOKEN>
 *
 *   {
 *     "automation": { "key": "dashboard-erreichbarkeit", "name": "…" },
 *     "status": "success" | "failed",
 *     "duration_ms": 412,
 *     "items_processed": 1,
 *     "output": { … },
 *     "error":  { "message": "…", "code": "HTTP_503" },
 *     "logs":   [{ "level": "info", "message": "…" }]
 *   }
 */

type Eingang = {
  automation?: {
    key?: string
    name?: string
    description?: string
    category?: string
    source?: string
    schedule_label?: string
    owner?: string
  }
  status?: string
  trigger?: string
  started_at?: string
  finished_at?: string
  duration_ms?: number
  items_processed?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: { message?: string; code?: string; severity?: string; stack?: string }
  logs?: { level?: string; message?: string; ts?: string }[]
  external_id?: string
}

const STATUS = ['queued', 'running', 'success', 'failed', 'cancelled']
const QUELLEN = ['n8n', 'cron', 'python', 'webhook', 'extern', 'manual']
const AUSLOESER = ['schedule', 'manual', 'webhook', 'retry']
const STUFEN = ['debug', 'info', 'warn', 'error']
const SCHWERE = ['warning', 'error', 'critical']

function tokenStimmt(kopf: string | null): boolean {
  const erwartet = process.env.INGEST_TOKEN
  if (!erwartet || erwartet.length < 16) return false

  const gegeben = kopf?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const a = Buffer.from(gegeben)
  const b = Buffer.from(erwartet)
  return a.length === b.length && timingSafeEqual(a, b)
}

function fehler(meldung: string, code = 400) {
  return NextResponse.json({ ok: false, fehler: meldung }, { status: code })
}

export async function POST(request: Request) {
  if (!process.env.INGEST_TOKEN) {
    return fehler('Die Anschlussstelle ist nicht eingerichtet: INGEST_TOKEN fehlt.', 503)
  }
  if (!tokenStimmt(request.headers.get('authorization'))) {
    return fehler('Zugriffsschlüssel fehlt oder stimmt nicht.', 401)
  }

  let daten: Eingang
  try {
    daten = await request.json()
  } catch {
    return fehler('Der Inhalt ist kein gültiges JSON.')
  }

  const key = daten.automation?.key?.trim()
  if (!key) return fehler('automation.key fehlt - daran wird die Automation erkannt.')

  const status = daten.status ?? 'success'
  if (!STATUS.includes(status)) {
    return fehler('Unbekannter status "' + status + '". Erlaubt: ' + STATUS.join(', '))
  }

  const quelle = daten.automation?.source ?? 'n8n'
  if (!QUELLEN.includes(quelle)) {
    return fehler('Unbekannte source "' + quelle + '". Erlaubt: ' + QUELLEN.join(', '))
  }

  const ausloeser = daten.trigger ?? 'schedule'
  if (!AUSLOESER.includes(ausloeser)) {
    return fehler('Unbekannter trigger "' + ausloeser + '". Erlaubt: ' + AUSLOESER.join(', '))
  }

  const start = daten.started_at ? new Date(daten.started_at) : new Date()
  const ende = daten.finished_at
    ? new Date(daten.finished_at)
    : status === 'running' || status === 'queued'
      ? null
      : new Date()

  if (Number.isNaN(start.getTime()) || (ende && Number.isNaN(ende.getTime()))) {
    return fehler('started_at oder finished_at ist kein gültiger Zeitpunkt.')
  }

  const dauer = daten.duration_ms ?? (ende ? ende.getTime() - start.getTime() : null)

  try {
    // Automation anlegen, falls sie noch nicht bekannt ist. Name und
    // Beschreibung werden nur beim Anlegen gesetzt - wer sie im Dashboard
    // ändert, soll nicht beim nächsten Lauf überschrieben werden.
    const [automation] = await sql<{ id: string; name: string }[]>`
      insert into automations (key, name, description, category, source, schedule_label, owner, status)
      values (
        ${key},
        ${daten.automation?.name ?? key},
        ${daten.automation?.description ?? null},
        ${daten.automation?.category ?? null},
        ${quelle},
        ${daten.automation?.schedule_label ?? null},
        ${daten.automation?.owner ?? null},
        'active'
      )
      on conflict (key) do update
        set last_run_at = ${start},
            updated_at  = now(),
            status      = case
                            when ${status} = 'failed'                       then 'error'
                            when automations.status = 'error'               then 'active'
                            else automations.status
                          end
      returning id, name
    `

    const [lauf] = await sql<{ id: string }[]>`
      insert into executions (
        automation_id, status, trigger, started_at, finished_at, duration_ms,
        items_processed, input, output, error_message, external_id
      ) values (
        ${automation.id}, ${status}, ${ausloeser}, ${start}, ${ende}, ${dauer},
        ${daten.items_processed ?? 0},
        ${sql.json((daten.input ?? {}) as never)},
        ${sql.json((daten.output ?? {}) as never)},
        ${daten.error?.message ?? null},
        ${daten.external_id ?? null}
      )
      returning id
    `

    for (const zeile of (daten.logs ?? []).slice(0, 200)) {
      if (!zeile?.message) continue
      const stufe = STUFEN.includes(zeile.level ?? '') ? zeile.level : 'info'
      const zeit = zeile.ts ? new Date(zeile.ts) : new Date()
      await sql`
        insert into execution_logs (execution_id, ts, level, message)
        values (${lauf.id}, ${Number.isNaN(zeit.getTime()) ? new Date() : zeit}, ${stufe!}, ${zeile.message})
      `
    }

    let fehlerId: string | null = null
    if (daten.error?.message) {
      const schwere = SCHWERE.includes(daten.error.severity ?? '') ? daten.error.severity! : 'error'
      const [eintrag] = await sql<{ id: string }[]>`
        insert into errors (automation_id, execution_id, occurred_at, severity, code, message, stack)
        values (
          ${automation.id}, ${lauf.id}, ${ende ?? new Date()}, ${schwere},
          ${daten.error.code ?? null}, ${daten.error.message}, ${daten.error.stack ?? null}
        )
        returning id
      `
      fehlerId = eintrag.id
    }

    // last_run_at auch beim allerersten Lauf setzen (das insert oben tut es nur
    // im Konfliktfall).
    await sql`
      update automations set last_run_at = ${start} where id = ${automation.id} and last_run_at is null
    `

    return NextResponse.json({
      ok: true,
      automation: { id: automation.id, key, name: automation.name },
      execution_id: lauf.id,
      error_id: fehlerId,
    })
  } catch (err) {
    const meldung = err instanceof Error ? err.message : 'unbekannter Fehler'
    return NextResponse.json({ ok: false, fehler: 'Speichern fehlgeschlagen: ' + meldung }, { status: 500 })
  }
}
