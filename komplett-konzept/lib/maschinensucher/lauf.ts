import 'server-only'

/**
 * Jeder Lauf dieser Strecke ist ein Lauf im Dashboard.
 *
 * Es gibt bewusst KEINE eigene Protokolltabelle für Maschinensucher. Ein
 * Abgleich mit Plenty und eine Abholung durch Maschinensucher sind
 * Ausführungen wie jede andere — mit Dauer, Anzahl, Logzeilen und im
 * Fehlerfall einem Eintrag in "errors". Eine zweite Liste daneben würde
 * niemand ansehen, und die Übersichtsseite wüsste nichts davon.
 *
 * Der Weg ist derselbe wie bei /api/ingest/execution, nur ohne Umweg über
 * HTTP: Wir laufen ja selbst in dieser Anwendung.
 */

import { sql } from '@/lib/db'

export type LaufStatus = 'success' | 'failed'
export type Logstufe = 'debug' | 'info' | 'warn' | 'error'

export interface Logzeile {
  level?: Logstufe
  message: string
}

export interface Laufbericht {
  /** Schlüssel der Automation, z. B. "maschinensucher-abholung". */
  key: string
  status: LaufStatus
  trigger?: 'schedule' | 'manual' | 'webhook' | 'retry'
  startedAt: Date
  itemsProcessed?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  fehler?: { message: string; code?: string; severity?: 'warning' | 'error' | 'critical' }
  logs?: Logzeile[]
}

/** Die Automation zum Schlüssel. Fehlt sie, gibt es nichts zu protokollieren. */
async function automationId(key: string): Promise<string | null> {
  const [zeile] = await sql<{ id: string }[]>`select id::text from automations where key = ${key}`
  return zeile?.id ?? null
}

/**
 * Schreibt einen abgeschlossenen Lauf weg.
 *
 * Wirft NICHT. Ein Protokolleintrag, der scheitert, darf die Sache selbst
 * nicht aufhalten — sonst fällt der Marktplatz aus, weil eine Notiz klemmt.
 */
export async function laufMelden(bericht: Laufbericht): Promise<string | null> {
  try {
    const id = await automationId(bericht.key)
    if (!id) return null

    const fertig = new Date()
    const dauer = fertig.getTime() - bericht.startedAt.getTime()

    const [lauf] = await sql<{ id: string }[]>`
      insert into executions (
        automation_id, status, trigger, started_at, finished_at, duration_ms,
        items_processed, input, output, error_message
      ) values (
        ${id}, ${bericht.status}, ${bericht.trigger ?? 'webhook'},
        ${bericht.startedAt}, ${fertig}, ${dauer},
        ${bericht.itemsProcessed ?? 0},
        ${sql.json((bericht.input ?? {}) as never)},
        ${sql.json((bericht.output ?? {}) as never)},
        ${bericht.fehler?.message ?? null}
      )
      returning id::text
    `

    for (const zeile of bericht.logs ?? []) {
      await sql`
        insert into execution_logs (execution_id, level, message)
        values (${lauf.id}, ${zeile.level ?? 'info'}, ${zeile.message})
      `
    }

    if (bericht.fehler) {
      await sql`
        insert into errors (automation_id, execution_id, severity, code, message)
        values (${id}, ${lauf.id}, ${bericht.fehler.severity ?? 'error'},
                ${bericht.fehler.code ?? null}, ${bericht.fehler.message})
      `
    }

    await sql`update automations set last_run_at = ${fertig}, updated_at = now() where id = ${id}`
    return lauf.id
  } catch {
    return null
  }
}

/**
 * Wie viele Inserate die letzte erfolgreiche Abholung enthielt.
 *
 * Grundlage der Notbremse (rueckgang.ts). Gelesen wird aus "executions" — die
 * Läufe sind das Gedächtnis dieser Strecke.
 */
export async function letzteAbholungMenge(key = 'maschinensucher-abholung'): Promise<number | null> {
  const [zeile] = await sql<{ items_processed: number }[]>`
    select e.items_processed
      from executions e
      join automations a on a.id = e.automation_id
     where a.key = ${key} and e.status = 'success' and e.items_processed > 0
     order by e.started_at desc
     limit 1
  `
  return zeile?.items_processed ?? null
}

// ---------------------------------------------------------------------------
// Freigabe eines Rückgangs
// ---------------------------------------------------------------------------

const FREIGABE_SCHLUESSEL = 'maschinensucher.rueckgang_frei_bis'

/** Bis wann ein Rückgang freigegeben ist. Null, wenn nie oder abgelaufen. */
export async function freigabeStand(): Promise<string | null> {
  const [zeile] = await sql<{ value: unknown }[]>`
    select value from settings where key = ${FREIGABE_SCHLUESSEL}
  `
  const wert = zeile?.value
  return typeof wert === 'string' ? wert : null
}

export async function freigabeSetzen(bis: string): Promise<void> {
  await sql`
    insert into settings (key, value, updated_at)
    values (${FREIGABE_SCHLUESSEL}, ${sql.json(bis as never)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `
}

/** Die letzten Läufe einer Automation — für die Seite, nicht für die Logik. */
export async function letzteLaeufe(
  key: string,
  limit = 5,
): Promise<
  Array<{
    id: string
    status: string
    started_at: Date
    duration_ms: number | null
    items_processed: number
    output: Record<string, unknown>
    error_message: string | null
  }>
> {
  return sql`
    select e.id::text, e.status, e.started_at, e.duration_ms, e.items_processed, e.output, e.error_message
      from executions e
      join automations a on a.id = e.automation_id
     where a.key = ${key}
     order by e.started_at desc
     limit ${limit}
  ` as never
}
