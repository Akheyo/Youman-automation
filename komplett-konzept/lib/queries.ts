import 'server-only'
import { sql } from './db'
import type {
  Automation,
  AutomationMitKennzahlen,
  AusfuehrungMitAutomation,
  FehlerMitAutomation,
  LogZeile,
  Nutzer,
  ProtokollEintrag,
} from './types'

// ---------------------------------------------------------------------------
// Kennzahlen für die Übersicht
// ---------------------------------------------------------------------------
export interface Kennzahlen {
  automationen_gesamt: number
  automationen_aktiv: number
  automationen_pausiert: number
  automationen_fehler: number
  laeufe_24h: number
  laeufe_laufend: number
  fehlgeschlagen_24h: number
  erfolgsquote_24h: number | null
  offene_fehler: number
}

export async function kennzahlen(): Promise<Kennzahlen> {
  const [z] = await sql<Kennzahlen[]>`
    select
      (select count(*) from automations)::int                                       as automationen_gesamt,
      (select count(*) from automations where status = 'active')::int               as automationen_aktiv,
      (select count(*) from automations where status = 'paused')::int               as automationen_pausiert,
      (select count(*) from automations where status = 'error')::int                as automationen_fehler,
      (select count(*) from executions where started_at > now() - interval '24 hours')::int as laeufe_24h,
      (select count(*) from executions where status = 'running')::int               as laeufe_laufend,
      (select count(*) from executions
        where started_at > now() - interval '24 hours' and status = 'failed')::int  as fehlgeschlagen_24h,
      (select case
                when count(*) filter (where status in ('success','failed')) = 0 then null
                else round(
                  100.0 * count(*) filter (where status = 'success')
                  / count(*) filter (where status in ('success','failed')), 1)::float8
              end
         from executions where started_at > now() - interval '24 hours')            as erfolgsquote_24h,
      (select count(*) from errors where status = 'open')::int                      as offene_fehler
  `
  return z
}

// ---------------------------------------------------------------------------
// Automationen
// ---------------------------------------------------------------------------
export async function automationenMitKennzahlen(): Promise<AutomationMitKennzahlen[]> {
  return sql<AutomationMitKennzahlen[]>`
    select a.*,
      coalesce(k.laeufe_24h, 0)::int   as laeufe_24h,
      coalesce(k.fehler_24h, 0)::int   as fehler_24h,
      coalesce(f.offene_fehler, 0)::int as offene_fehler,
      k.erfolgsquote,
      l.status      as letzter_status,
      l.duration_ms as letzte_dauer_ms
    from automations a
    left join lateral (
      select count(*)                                    as laeufe_24h,
             count(*) filter (where status = 'failed')   as fehler_24h,
             case when count(*) filter (where status in ('success','failed')) = 0 then null
                  else round(100.0 * count(*) filter (where status = 'success')
                       / count(*) filter (where status in ('success','failed')), 1)::float8
             end                                          as erfolgsquote
        from executions e
       where e.automation_id = a.id
         and e.started_at > now() - interval '24 hours'
    ) k on true
    left join lateral (
      select count(*) as offene_fehler
        from errors x where x.automation_id = a.id and x.status = 'open'
    ) f on true
    left join lateral (
      select status, duration_ms
        from executions e
       where e.automation_id = a.id
       order by e.started_at desc
       limit 1
    ) l on true
    order by
      case a.status when 'error' then 0 when 'active' then 1 when 'paused' then 2 else 3 end,
      a.name
  `
}

export async function automationHolen(id: string): Promise<Automation | null> {
  const zeilen = await sql<Automation[]>`select * from automations where id = ${id} limit 1`
  return zeilen[0] ?? null
}

/** Läufe je Tag der letzten 14 Tage - für den kleinen Verlaufsbalken. */
export async function verlauf14Tage(automationId?: string) {
  return sql<{ tag: string; erfolg: number; fehler: number }[]>`
    select to_char(d.tag, 'YYYY-MM-DD') as tag,
           coalesce(count(e.id) filter (where e.status = 'success'), 0)::int as erfolg,
           coalesce(count(e.id) filter (where e.status = 'failed'), 0)::int  as fehler
      from generate_series(current_date - interval '13 days', current_date, interval '1 day') as d(tag)
      left join executions e
        on e.started_at >= d.tag
       and e.started_at <  d.tag + interval '1 day'
       ${automationId ? sql`and e.automation_id = ${automationId}` : sql``}
     group by d.tag
     order by d.tag
  `
}

// ---------------------------------------------------------------------------
// Ausführungen
// ---------------------------------------------------------------------------
export interface AusfuehrungFilter {
  automationId?: string
  status?: string
  zeitraum?: '24h' | '7d' | '30d' | 'alle'
  limit?: number
  offset?: number
}

export async function ausfuehrungen(f: AusfuehrungFilter = {}) {
  const limit = Math.min(f.limit ?? 50, 200)
  const offset = f.offset ?? 0

  const zeitBedingung =
    f.zeitraum === '7d' ? sql`and e.started_at > now() - interval '7 days'`
    : f.zeitraum === '30d' ? sql`and e.started_at > now() - interval '30 days'`
    : f.zeitraum === 'alle' ? sql``
    : sql`and e.started_at > now() - interval '24 hours'`

  const rows = await sql<AusfuehrungMitAutomation[]>`
    select e.*, a.name as automation_name, a.key as automation_key, u.name as ausgeloest_von
      from executions e
      join automations a on a.id = e.automation_id
      left join users u on u.id = e.triggered_by
     where true
       ${f.automationId ? sql`and e.automation_id = ${f.automationId}` : sql``}
       ${f.status && f.status !== 'alle' ? sql`and e.status = ${f.status}` : sql``}
       ${zeitBedingung}
     order by e.started_at desc
     limit ${limit} offset ${offset}
  `

  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n
      from executions e
     where true
       ${f.automationId ? sql`and e.automation_id = ${f.automationId}` : sql``}
       ${f.status && f.status !== 'alle' ? sql`and e.status = ${f.status}` : sql``}
       ${zeitBedingung}
  `

  return { zeilen: rows, gesamt: n, limit, offset }
}

export async function ausfuehrungHolen(id: string): Promise<AusfuehrungMitAutomation | null> {
  const zeilen = await sql<AusfuehrungMitAutomation[]>`
    select e.*, a.name as automation_name, a.key as automation_key, u.name as ausgeloest_von
      from executions e
      join automations a on a.id = e.automation_id
      left join users u on u.id = e.triggered_by
     where e.id = ${id}
     limit 1
  `
  return zeilen[0] ?? null
}

export async function logsZuAusfuehrung(id: string): Promise<LogZeile[]> {
  return sql<LogZeile[]>`
    select * from execution_logs where execution_id = ${id} order by ts asc, id asc limit 500
  `
}

// ---------------------------------------------------------------------------
// Fehler
// ---------------------------------------------------------------------------
export interface FehlerFilter {
  status?: string
  severity?: string
  automationId?: string
  limit?: number
  offset?: number
}

export async function fehlerListe(f: FehlerFilter = {}) {
  const limit = Math.min(f.limit ?? 50, 200)
  const offset = f.offset ?? 0

  const rows = await sql<FehlerMitAutomation[]>`
    select x.*, a.name as automation_name, a.key as automation_key, u.name as bearbeitet_von
      from errors x
      left join automations a on a.id = x.automation_id
      left join users u on u.id = x.acknowledged_by
     where true
       ${f.status && f.status !== 'alle' ? sql`and x.status = ${f.status}` : sql``}
       ${f.severity && f.severity !== 'alle' ? sql`and x.severity = ${f.severity}` : sql``}
       ${f.automationId ? sql`and x.automation_id = ${f.automationId}` : sql``}
     order by
       case x.status when 'open' then 0 when 'acknowledged' then 1 else 2 end,
       x.occurred_at desc
     limit ${limit} offset ${offset}
  `

  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from errors x
     where true
       ${f.status && f.status !== 'alle' ? sql`and x.status = ${f.status}` : sql``}
       ${f.severity && f.severity !== 'alle' ? sql`and x.severity = ${f.severity}` : sql``}
       ${f.automationId ? sql`and x.automation_id = ${f.automationId}` : sql``}
  `

  return { zeilen: rows, gesamt: n, limit, offset }
}

export async function fehlerHolen(id: string): Promise<FehlerMitAutomation | null> {
  const zeilen = await sql<FehlerMitAutomation[]>`
    select x.*, a.name as automation_name, a.key as automation_key, u.name as bearbeitet_von
      from errors x
      left join automations a on a.id = x.automation_id
      left join users u on u.id = x.acknowledged_by
     where x.id = ${id} limit 1
  `
  return zeilen[0] ?? null
}

// ---------------------------------------------------------------------------
// Nutzer & Protokoll
// ---------------------------------------------------------------------------
export async function nutzerListe(): Promise<Nutzer[]> {
  return sql<Nutzer[]>`
    select id, email, name, role, is_active, last_login_at, created_at
      from users order by name
  `
}

export async function protokoll(limit = 50): Promise<ProtokollEintrag[]> {
  return sql<ProtokollEintrag[]>`
    select id::text, at, user_name, action, target_type, target_id, target_name, meta
      from audit_log order by at desc limit ${limit}
  `
}

export async function protokollSchreiben(eintrag: {
  userId?: string | null
  userName?: string | null
  action: string
  targetType?: string
  targetId?: string
  targetName?: string
  meta?: Record<string, unknown>
}) {
  await sql`
    insert into audit_log (user_id, user_name, action, target_type, target_id, target_name, meta)
    values (
      ${eintrag.userId ?? null}, ${eintrag.userName ?? null}, ${eintrag.action},
      ${eintrag.targetType ?? null}, ${eintrag.targetId ?? null}, ${eintrag.targetName ?? null},
      ${sql.json((eintrag.meta ?? {}) as never)}
    )
  `
}
