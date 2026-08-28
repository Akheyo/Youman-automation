'use server'

import { revalidatePath } from 'next/cache'
import { rolleErzwingen } from '@/lib/auth'
import { sql } from '@/lib/db'
import { hashPassword } from '@/lib/password.mjs'
import { protokollSchreiben } from '@/lib/queries'
import { aktuellerNutzer } from '@/lib/session'
import type { Rolle } from '@/lib/types'

async function admin() {
  const nutzer = await aktuellerNutzer()
  rolleErzwingen(nutzer, 'admin')
  return nutzer
}

export async function nutzerAnlegen(_prev: unknown, formData: FormData) {
  let ich
  try {
    ich = await admin()
  } catch {
    return { fehler: 'Nur Administratoren dürfen Nutzer anlegen.' }
  }

  const email = String(formData.get('email') ?? '').toLowerCase().trim()
  const name = String(formData.get('name') ?? '').trim()
  const rolle = String(formData.get('rolle') ?? 'viewer') as Rolle
  const passwort = String(formData.get('passwort') ?? '')

  if (!email || !name) return { fehler: 'Name und E-Mail sind Pflicht.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { fehler: 'Die E-Mail-Adresse sieht nicht gültig aus.' }
  if (passwort.length < 10) return { fehler: 'Das Passwort braucht mindestens 10 Zeichen.' }
  if (!['admin', 'operator', 'viewer'].includes(rolle)) return { fehler: 'Unbekannte Rolle.' }

  const [vorhanden] = await sql`select id from users where email = ${email}`
  if (vorhanden) return { fehler: 'Diese E-Mail ist bereits vergeben.' }

  const hash = await hashPassword(passwort)
  await sql`
    insert into users (email, name, role, password_hash)
    values (${email}, ${name}, ${rolle}, ${hash})
  `

  await protokollSchreiben({
    userId: ich.id,
    userName: ich.name,
    action: 'nutzer.angelegt',
    targetType: 'user',
    targetName: name,
    meta: { rolle },
  })

  revalidatePath('/nutzer')
  return { ok: name + ' wurde angelegt.' }
}

export async function nutzerUmschalten(userId: string, aktiv: boolean) {
  const ich = await admin()
  if (ich.id === userId && !aktiv) throw new Error('Du kannst dich nicht selbst deaktivieren.')

  const [n] = await sql<{ name: string }[]>`
    update users set is_active = ${aktiv}, updated_at = now() where id = ${userId} returning name
  `
  if (!n) throw new Error('Nutzer nicht gefunden.')

  if (!aktiv) await sql`delete from sessions where user_id = ${userId}`

  await protokollSchreiben({
    userId: ich.id,
    userName: ich.name,
    action: aktiv ? 'nutzer.aktiviert' : 'nutzer.deaktiviert',
    targetType: 'user',
    targetId: userId,
    targetName: n.name,
  })

  revalidatePath('/nutzer')
}

export async function rolleAendern(userId: string, rolle: Rolle) {
  const ich = await admin()
  if (ich.id === userId) throw new Error('Deine eigene Rolle kann nur ein anderer Administrator ändern.')

  const [n] = await sql<{ name: string }[]>`
    update users set role = ${rolle}, updated_at = now() where id = ${userId} returning name
  `
  if (!n) throw new Error('Nutzer nicht gefunden.')

  await protokollSchreiben({
    userId: ich.id,
    userName: ich.name,
    action: 'nutzer.rolle_geändert',
    targetType: 'user',
    targetId: userId,
    targetName: n.name,
    meta: { rolle },
  })

  revalidatePath('/nutzer')
}
