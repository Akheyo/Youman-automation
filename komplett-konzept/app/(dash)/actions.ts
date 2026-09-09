'use server'

import { redirect } from 'next/navigation'
import { sitzungBeenden } from '@/lib/session'

export async function abmelden() {
  await sitzungBeenden()
  redirect('/login')
}
