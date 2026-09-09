'use server'

// ---------------------------------------------------------------------------
// Steuer-Aktionen des Dashboards.
//
// WICHTIG: Das Dashboard fuehrt (noch) selbst nichts aus. Diese Aktionen
// ändern den Zustand in der Datenbank und schreiben ins Protokoll - der
// spätere Runner (n8n, Cron, Python) liest den Zustand und handelt danach.
// Ein Klick auf "Jetzt ausführen" legt also einen Lauf mit Status "wartet"
// an; abgeholt wird er, sobald die Ausführungsschicht steht.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache'
import { rolleErzwingen } from '@/lib/auth'
import { sql } from '@/lib/db'
import { protokollSchreiben } from '@/lib/queries'
import { aktuellerNutzer } from '@/lib/session'

async function bediener() {
  const nutzer = await aktuellerNutzer()
  rolleErzwingen(nutzer, 'operator')
  return nutzer
}

function alleSeitenAktualisieren() {
  revalidatePath('/', 'layout')
}

export async function automationUmschalten(automationId: string, neuerStatus: 'active' | 'paused') {
  const nutzer = await bediener()

  const [auto] = await sql<{ name: string }[]>`
    update automations
       set status = ${neuerStatus}, updated_at = now()
     where id = ${automationId}
     returning name
  `
  if (!auto) throw new Error('Automation nicht gefunden.')

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: neuerStatus === 'active' ? 'automation.aktiviert' : 'automation.pausiert',
    targetType: 'automation',
    targetId: automationId,
    targetName: auto.name,
  })

  alleSeitenAktualisieren()
}

export async function automationJetztAusfuehren(automationId: string) {
  const nutzer = await bediener()

  const [auto] = await sql<{ name: string; source: string }[]>`
    select name, source from automations where id = ${automationId}
  `
  if (!auto) throw new Error('Automation nicht gefunden.')

  const [lauf] = await sql<{ id: string }[]>`
    insert into executions (automation_id, status, trigger, triggered_by, input)
    values (${automationId}, 'queued', 'manual', ${nutzer.id}, ${sql.json({ quelle: auto.source })})
    returning id
  `

  await sql`
    insert into execution_logs (execution_id, level, message)
    values (${lauf.id}, 'info', ${'Manuell angestoßen von ' + nutzer.name + ' - wartet auf die Ausführungsschicht.'})
  `

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: 'automation.manuell_gestartet',
    targetType: 'automation',
    targetId: automationId,
    targetName: auto.name,
    meta: { execution_id: lauf.id },
  })

  alleSeitenAktualisieren()
}

export async function laufWiederholen(executionId: string) {
  const nutzer = await bediener()

  const [alt] = await sql<{ automation_id: string; input: Record<string, unknown>; name: string }[]>`
    select e.automation_id, e.input, a.name
      from executions e join automations a on a.id = e.automation_id
     where e.id = ${executionId}
  `
  if (!alt) throw new Error('Ausführung nicht gefunden.')

  const [neu] = await sql<{ id: string }[]>`
    insert into executions (automation_id, status, trigger, triggered_by, input, retry_of)
    values (${alt.automation_id}, 'queued', 'retry', ${nutzer.id}, ${sql.json(alt.input as never)}, ${executionId})
    returning id
  `

  await sql`
    insert into execution_logs (execution_id, level, message)
    values (${neu.id}, 'info', ${'Wiederholung von Lauf ' + executionId.slice(0, 8) + ' durch ' + nutzer.name + '.'})
  `

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: 'lauf.wiederholt',
    targetType: 'execution',
    targetId: executionId,
    targetName: alt.name,
    meta: { neuer_lauf: neu.id },
  })

  alleSeitenAktualisieren()
}

export async function laufAbbrechen(executionId: string) {
  const nutzer = await bediener()

  const [lauf] = await sql<{ id: string }[]>`
    update executions
       set status = 'cancelled', finished_at = now(),
           duration_ms = coalesce(duration_ms, extract(epoch from (now() - started_at)) * 1000)
     where id = ${executionId} and status in ('queued', 'running')
     returning id
  `
  if (!lauf) throw new Error('Dieser Lauf laeuft nicht mehr.')

  await sql`
    insert into execution_logs (execution_id, level, message)
    values (${executionId}, 'warn', ${'Abgebrochen durch ' + nutzer.name + '.'})
  `

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: 'lauf.abgebrochen',
    targetType: 'execution',
    targetId: executionId,
  })

  alleSeitenAktualisieren()
}

export async function fehlerStatusSetzen(fehlerId: string, status: 'open' | 'acknowledged' | 'resolved') {
  const nutzer = await bediener()

  const [fehler] = await sql<{ id: string }[]>`
    update errors
       set status          = ${status},
           acknowledged_by = ${status === 'open' ? null : nutzer.id},
           acknowledged_at = ${status === 'acknowledged' ? sql`now()` : sql`acknowledged_at`},
           resolved_at     = ${status === 'resolved' ? sql`now()` : null}
     where id = ${fehlerId}
     returning id
  `
  if (!fehler) throw new Error('Fehler nicht gefunden.')

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: 'fehler.' + (status === 'resolved' ? 'erledigt' : status === 'acknowledged' ? 'übernommen' : 'wieder_geöffnet'),
    targetType: 'error',
    targetId: fehlerId,
  })

  alleSeitenAktualisieren()
}

export async function alleFehlerErledigen(automationId: string) {
  const nutzer = await bediener()

  const betroffen = await sql`
    update errors set status = 'resolved', resolved_at = now(), acknowledged_by = ${nutzer.id}
     where automation_id = ${automationId} and status <> 'resolved'
     returning id
  `

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: 'fehler.sammel_erledigt',
    targetType: 'automation',
    targetId: automationId,
    meta: { anzahl: betroffen.length },
  })

  alleSeitenAktualisieren()
}
