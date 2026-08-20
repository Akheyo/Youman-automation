import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { sql } from './db'
import type { Nutzer } from './types'

const COOKIE = 'kk_session'
const LAUFZEIT_TAGE = 14

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET fehlt oder ist zu kurz - mit "openssl rand -hex 32" erzeugen')
  }
  return s
}

function signieren(id: string): string {
  const sig = createHmac('sha256', secret()).update(id).digest('hex')
  return id + '.' + sig
}

function pruefen(wert: string): string | null {
  const [id, sig] = wert.split('.')
  if (!id || !sig) return null
  const erwartet = createHmac('sha256', secret()).update(id).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(erwartet)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return id
}

/**
 * Cookie nur dann als "secure" markieren, wenn die Seite wirklich über HTTPS
 * laeuft. Sonst verwirft der Browser es beim Betrieb ohne Domain/Zertifikat
 * (z.B. direkt über die Server-IP) und der Login dreht sich im Kreis.
 */
function laeuftUeberHttps(): boolean {
  const proto = headers().get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (proto) return proto === 'https'
  return (process.env.APP_URL ?? '').startsWith('https://')
}

export async function sitzungAnlegen(userId: string, userAgent?: string, ip?: string) {
  const id = randomBytes(32).toString('hex')
  const ablauf = new Date(Date.now() + LAUFZEIT_TAGE * 86_400_000)

  await sql`
    insert into sessions (id, user_id, expires_at, user_agent, ip)
    values (${id}, ${userId}, ${ablauf}, ${userAgent ?? null}, ${ip ?? null})
  `

  cookies().set(COOKIE, signieren(id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: laeuftUeberHttps(),
    path: '/',
    expires: ablauf,
  })
}

export async function sitzungBeenden() {
  const wert = cookies().get(COOKIE)?.value
  const id = wert ? pruefen(wert) : null
  if (id) {
    await sql`delete from sessions where id = ${id}`
  }
  cookies().delete(COOKIE)
}

/** Liefert den angemeldeten Nutzer oder null. Wird pro Anfrage einmal aufgerufen. */
export async function aktuellerNutzer(): Promise<Nutzer | null> {
  const wert = cookies().get(COOKIE)?.value
  if (!wert) return null
  const id = pruefen(wert)
  if (!id) return null

  const zeilen = await sql<Nutzer[]>`
    select u.id, u.email, u.name, u.role, u.is_active, u.last_login_at, u.created_at
      from sessions s
      join users u on u.id = s.user_id
     where s.id = ${id}
       and s.expires_at > now()
       and u.is_active = true
     limit 1
  `
  return zeilen[0] ?? null
}

/** Abgelaufene Sitzungen aufraeumen - wird beim Login nebenbei mitgemacht. */
export async function abgelaufeneSitzungenLoeschen() {
  await sql`delete from sessions where expires_at < now()`
}
