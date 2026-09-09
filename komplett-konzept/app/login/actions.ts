'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { verifyPassword } from '@/lib/password.mjs'
import { abgelaufeneSitzungenLoeschen, sitzungAnlegen } from '@/lib/session'

export async function anmelden(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').toLowerCase().trim()
  const passwort = String(formData.get('passwort') ?? '')

  // Die E-Mail geht mit zurück, damit sie nach einem Fehlversuch stehen bleibt -
  // auch dann, wenn im Browser kein JavaScript laeuft.
  if (!email || !passwort) {
    return { fehler: 'Bitte E-Mail und Passwort eingeben.', email }
  }

  const [nutzer] = await sql<{ id: string; password_hash: string; is_active: boolean }[]>`
    select id, password_hash, is_active from users where email = ${email} limit 1
  `

  // Bewusst dieselbe Meldung für "kein Nutzer" und "falsches Passwort" -
  // sonst kann man über das Formular gültige Adressen abfragen.
  const passt = nutzer ? await verifyPassword(passwort, nutzer.password_hash) : false

  if (!nutzer || !passt || !nutzer.is_active) {
    return { fehler: 'E-Mail oder Passwort stimmt nicht.', email }
  }

  const kopf = headers()
  await sitzungAnlegen(
    nutzer.id,
    kopf.get('user-agent') ?? undefined,
    kopf.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  )
  await sql`update users set last_login_at = now() where id = ${nutzer.id}`
  await abgelaufeneSitzungenLoeschen()

  redirect('/')
}
