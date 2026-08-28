#!/usr/bin/env node
// Legt einen Nutzer an oder setzt dessen Passwort neu.
//
//   node scripts/create-admin.mjs "amanuel@example.de" "Amanuel Kheyo" admin
//
// Das Passwort wird abgefragt (oder aus der Umgebungsvariable ADMIN_PASSWORD
// gelesen, praktisch für automatisiertes Aufsetzen).
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import postgres from 'postgres'
import { verbindungsOptionen } from '../lib/dbOptionen.mjs'
import { hashPassword } from '../lib/password.mjs'

const [email, name, role = 'admin'] = process.argv.slice(2)

if (!email || !name) {
  console.error('Aufruf: node scripts/create-admin.mjs "<email>" "<Name>" [admin|operator|viewer]')
  process.exit(1)
}
if (!['admin', 'operator', 'viewer'].includes(role)) {
  console.error('Unbekannte Rolle "' + role + '". Erlaubt: admin, operator, viewer')
  process.exit(1)
}

const url = process.env.DATABASE_URL ?? ''
const sql = postgres(url, { ...verbindungsOptionen(url), max: 1 })

try {
  let pw = process.env.ADMIN_PASSWORD
  if (!pw) {
    const rl = createInterface({ input: stdin, output: stdout })
    pw = await rl.question('Passwort für ' + email + ': ')
    const pw2 = await rl.question('Passwort wiederholen: ')
    rl.close()
    if (pw !== pw2) throw new Error('Die Passwörter stimmen nicht überein.')
  }

  if (pw.length < 10) throw new Error('Passwort muss mindestens 10 Zeichen haben.')

  const hash = await hashPassword(pw)
  const [user] = await sql`
    insert into users (email, name, role, password_hash)
    values (${email.toLowerCase().trim()}, ${name}, ${role}, ${hash})
    on conflict (email) do update
      set password_hash = excluded.password_hash,
          name          = excluded.name,
          role          = excluded.role,
          is_active     = true,
          updated_at    = now()
    returning id, email, name, role
  `
  console.log('OK - ' + user.name + ' <' + user.email + '> als "' + user.role + '" angelegt/aktualisiert.')
} catch (err) {
  console.error('Fehler:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
