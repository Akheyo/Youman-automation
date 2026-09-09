import 'server-only'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from './session'
import type { Nutzer, Rolle } from './types'

/** Nutzer holen oder zum Login schicken. Für geschuetzte Seiten. */
export async function nutzerErzwingen(): Promise<Nutzer> {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/login')
  return nutzer
}

const RANG: Record<Rolle, number> = { viewer: 0, operator: 1, admin: 2 }

export function darfSteuern(nutzer: Nutzer | null): boolean {
  return !!nutzer && RANG[nutzer.role] >= RANG.operator
}

export function istAdmin(nutzer: Nutzer | null): boolean {
  return !!nutzer && nutzer.role === 'admin'
}

/** Wirft, wenn die Rolle nicht reicht. Für Server Actions. */
export function rolleErzwingen(nutzer: Nutzer | null, mindestens: Rolle): asserts nutzer is Nutzer {
  if (!nutzer || RANG[nutzer.role] < RANG[mindestens]) {
    throw new Error('Dafür fehlen dir die Rechte.')
  }
}

export const ROLLEN_LABEL: Record<Rolle, string> = {
  admin: 'Administrator',
  operator: 'Bediener',
  viewer: 'Betrachter',
}
