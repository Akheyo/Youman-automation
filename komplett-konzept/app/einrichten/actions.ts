'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { hashPassword } from '@/lib/password.mjs'
import { sitzungAnlegen } from '@/lib/session'

/**
 * Legt den allerersten Administrator an. Greift nur, solange es noch gar keinen
 * Nutzer gibt - danach laeuft alles ueber die Nutzerverwaltung im Dashboard.
 */
export async function ersteinrichtung(_prev: unknown, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').toLowerCase().trim()
  const passwort = String(formData.get('passwort') ?? '')
  const wiederholung = String(formData.get('wiederholung') ?? '')

  const zurueck = { name, email }

  if (!name || !email) return { ...zurueck, fehler: 'Name und E-Mail sind Pflicht.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ...zurueck, fehler: 'Die E-Mail-Adresse sieht nicht gültig aus.' }
  }
  if (passwort.length < 10) return { ...zurueck, fehler: 'Das Passwort braucht mindestens 10 Zeichen.' }
  if (passwort !== wiederholung) return { ...zurueck, fehler: 'Die beiden Passwörter stimmen nicht überein.' }

  const hash = await hashPassword(passwort)

  // Der Einschub "where not exists" ist die eigentliche Absicherung: selbst wenn
  // zwei Leute die Seite gleichzeitig abschicken, entsteht nur ein Konto.
  const angelegt = await sql<{ id: string }[]>`
    insert into users (email, name, role, password_hash)
    select ${email}, ${name}, 'admin', ${hash}
     where not exists (select 1 from users)
    returning id
  `

  if (angelegt.length === 0) {
    return { ...zurueck, fehler: 'Es gibt bereits einen Zugang. Bitte melde dich an.' }
  }

  const kopf = headers()
  await sitzungAnlegen(
    angelegt[0].id,
    kopf.get('user-agent') ?? undefined,
    kopf.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  )
  await sql`update users set last_login_at = now() where id = ${angelegt[0].id}`

  redirect('/')
}
