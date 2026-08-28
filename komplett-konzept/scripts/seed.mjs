#!/usr/bin/env node
// Befuellt das Dashboard mit Beispieldaten, damit man sofort etwas sieht.
// Die echten Automationen kommen später - diese hier sind reine Attrappen
// und lassen sich jederzeit mit "node scripts/seed.mjs --leeren" entfernen.
import postgres from 'postgres'
import { verbindungsOptionen } from '../lib/dbOptionen.mjs'

const url = process.env.DATABASE_URL ?? ''
const sql = postgres(url, { ...verbindungsOptionen(url), max: 1 })
const leeren = process.argv.includes('--leeren')

const AUTOMATIONEN = [
  {
    key: 'lead-import',
    name: 'Lead-Import',
    description: 'Holt neue Anfragen aus dem Web-Formular und legt sie als Lead an.',
    category: 'Vertrieb',
    source: 'webhook',
    status: 'active',
    schedule_label: 'bei Eingang',
    owner: 'Amanuel Kheyo',
  },
  {
    key: 'angebots-mails',
    name: 'Angebots-Mails',
    description: 'Versendet Angebote an qualifizierte Leads und protokolliert den Versand.',
    category: 'Vertrieb',
    source: 'cron',
    status: 'active',
    schedule_cron: '0 8 * * 1-5',
    schedule_label: 'Mo-Fr 08:00',
    owner: 'Amanuel Kheyo',
  },
  {
    key: 'anfragen-radar',
    name: 'Anfragen-Radar',
    description: 'Durchsucht Marktplätze nach passenden Kategorie-Anfragen.',
    category: 'Beschaffung',
    source: 'python',
    status: 'active',
    schedule_cron: '0 */4 * * *',
    schedule_label: 'alle 4 Stunden',
    owner: 'Amanuel Kheyo',
  },
  {
    key: 'termin-sync',
    name: 'Termin-Abgleich',
    description: 'Gleicht bestätigte Termine mit dem Google-Kalender ab.',
    category: 'Organisation',
    source: 'cron',
    status: 'error',
    schedule_cron: '*/15 * * * *',
    schedule_label: 'alle 15 Minuten',
    owner: 'Amanuel Kheyo',
  },
  {
    key: 'follow-up',
    name: 'Follow-up-Strecke',
    description: 'Erinnert automatisch nach 3 und 7 Tagen ohne Antwort.',
    category: 'Vertrieb',
    source: 'cron',
    status: 'active',
    schedule_cron: '0 9 * * *',
    schedule_label: 'täglich 09:00',
    owner: 'Amanuel Kheyo',
  },
  {
    key: 'rechnungs-export',
    name: 'Rechnungs-Export',
    description: 'Exportiert abgeschlossene Aufträge in die Buchhaltung.',
    category: 'Buchhaltung',
    source: 'n8n',
    status: 'paused',
    schedule_cron: '0 22 * * 5',
    schedule_label: 'freitags 22:00',
    owner: 'Amanuel Kheyo',
  },
]

const LOG_ERFOLG = [
  ['info', 'Automation gestartet'],
  ['info', 'Verbindung zur Quelle hergestellt'],
  ['info', 'Datensätze geladen'],
  ['info', 'Verarbeitung abgeschlossen'],
]

const FEHLER_VORLAGEN = [
  {
    code: 'AUTH_401',
    message: 'Google-Kalender: Zugriffstoken abgelaufen (401 Unauthorized)',
    severity: 'error',
    stack: 'GoogleCalendarClient.sync (lib/google.ts:88)\n  -> refreshToken() -> HTTP 401',
  },
  {
    code: 'TIMEOUT',
    message: 'Zeitüberschreitung beim Abruf der Marktplatz-Seite (30s)',
    severity: 'warning',
    stack: 'sources/marketplaces.py:142 requests.get(...) -> ReadTimeout',
  },
  {
    code: 'SMTP_550',
    message: 'Mailversand abgelehnt: Empfängeradresse existiert nicht',
    severity: 'error',
    stack: 'mailer.send() -> 550 5.1.1 recipient rejected',
  },
]

function minutenVorher(min) {
  return new Date(Date.now() - min * 60_000)
}

try {
  if (leeren) {
    await sql`truncate errors, execution_logs, executions, automations restart identity cascade`
    console.log('Beispieldaten entfernt.')
    process.exit(0)
  }

  const vorhanden = await sql`select count(*)::int as n from automations`
  if (vorhanden[0].n > 0) {
    console.log('Es sind bereits Automationen vorhanden - Seed übersprungen.')
    console.log('Zum Zurücksetzen: node scripts/seed.mjs --leeren')
    process.exit(0)
  }

  for (const a of AUTOMATIONEN) {
    const [auto] = await sql`
      insert into automations ${sql(a)}
      returning id, key, status
    `

    // Ausführungen ueber die letzten 14 Tage verteilen (ca. 3 Läufe pro Tag),
    // damit der Verlaufsbalken auf der Uebersicht auch etwas zu zeigen hat.
    // Ungleichmäßig verteilt: manche Tage laufen häufiger, manche gar nicht.
    // Gleichmäßige Balken sähen im Verlauf aus wie ein Fehler.
    const anzahl = 42
    for (let i = 0; i < anzahl; i++) {
      // Manche Läufe fallen aus, damit die Tage unterschiedlich voll sind.
      // Gleichmäßige Balken sähen im Verlauf aus wie ein kaputtes Diagramm.
      if ((i * 7 + a.key.length * 3) % 5 === 0) continue

      const schwankung = [0, 210, 480, 60, 900, 300, 130][i % 7]
      const startMin = i * 430 + schwankung + 9
      const gestartet = minutenVorher(startMin)
      const dauer = 2_000 + ((i * 7919) % 48_000)
      const schlaegtFehl = auto.status === 'error' ? i % 3 === 0 : i % 9 === 0
      const status = i === 0 && auto.status === 'active' && a.key === 'anfragen-radar'
        ? 'running'
        : schlaegtFehl
          ? 'failed'
          : 'success'
      const beendet = status === 'running' ? null : new Date(gestartet.getTime() + dauer)

      const [exec] = await sql`
        insert into executions (
          automation_id, status, trigger, started_at, finished_at, duration_ms,
          items_processed, input, output, error_message
        ) values (
          ${auto.id},
          ${status},
          ${i % 5 === 0 ? 'manual' : 'schedule'},
          ${gestartet},
          ${beendet},
          ${status === 'running' ? null : dauer},
          ${status === 'success' ? (i * 13) % 240 : 0},
          ${sql.json({ quelle: a.source, lauf: i + 1 })},
          ${sql.json(status === 'success' ? { verarbeitet: (i * 13) % 240, übersprungen: i % 4 } : {})},
          ${status === 'failed' ? FEHLER_VORLAGEN[i % FEHLER_VORLAGEN.length].message : null}
        )
        returning id
      `

      const zeilen = status === 'failed'
        ? [...LOG_ERFOLG.slice(0, 2), ['error', FEHLER_VORLAGEN[i % FEHLER_VORLAGEN.length].message]]
        : status === 'running'
          ? LOG_ERFOLG.slice(0, 2)
          : LOG_ERFOLG

      for (let z = 0; z < zeilen.length; z++) {
        await sql`
          insert into execution_logs (execution_id, ts, level, message)
          values (${exec.id}, ${new Date(gestartet.getTime() + z * 1200)}, ${zeilen[z][0]}, ${zeilen[z][1]})
        `
      }

      if (status === 'failed') {
        const v = FEHLER_VORLAGEN[i % FEHLER_VORLAGEN.length]
        await sql`
          insert into errors (automation_id, execution_id, occurred_at, severity, code, message, stack, status)
          values (
            ${auto.id}, ${exec.id}, ${new Date(gestartet.getTime() + dauer)},
            ${v.severity}, ${v.code}, ${v.message}, ${v.stack},
            ${i > 6 ? 'resolved' : 'open'}
          )
        `
      }
    }

    await sql`
      update automations
         set last_run_at = (select max(started_at) from executions where automation_id = ${auto.id}),
             next_run_at = now() + interval '37 minutes'
       where id = ${auto.id}
    `
  }

  const [{ n: anzAuto }] = await sql`select count(*)::int as n from automations`
  const [{ n: anzExec }] = await sql`select count(*)::int as n from executions`
  const [{ n: anzFehler }] = await sql`select count(*)::int as n from errors`
  console.log('Beispieldaten angelegt: ' + anzAuto + ' Automationen, ' + anzExec + ' Ausführungen, ' + anzFehler + ' Fehler.')
} catch (err) {
  console.error('Seed fehlgeschlagen:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
