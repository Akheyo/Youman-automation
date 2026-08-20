#!/usr/bin/env node
// Wendet alle noch nicht ausgeführten SQL-Dateien aus db/migrations an.
// Läuft beim Container-Start; bereits angewendete Dateien werden übersprungen.
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '..', 'db', 'migrations')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('[migrate] DATABASE_URL ist nicht gesetzt.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, onnotice: () => {} })

async function waitForDb(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await sql`select 1`
      return
    } catch (err) {
      if (i === attempts) throw err
      console.log('[migrate] Datenbank noch nicht bereit (Versuch ' + i + '/' + attempts + ') ...')
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

try {
  await waitForDb()
  await sql`
    create table if not exists _migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `
  const applied = new Set((await sql`select name from _migrations`).map((r) => r.name))
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

  let count = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const content = await readFile(join(migrationsDir, file), 'utf8')
    console.log('[migrate] wende an: ' + file)
    await sql.begin(async (tx) => {
      await tx.unsafe(content)
      await tx`insert into _migrations (name) values (${file})`
    })
    count++
  }
  console.log(count === 0 ? '[migrate] alles aktuell.' : '[migrate] ' + count + ' Migration(en) angewendet.')
} catch (err) {
  console.error('[migrate] fehlgeschlagen:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
