'use client'

import { abmelden } from '@/app/(dash)/actions'
import { IconAbmelden } from './Icons'

export function AbmeldeKnopf() {
  return (
    <form action={abmelden}>
      <button type="submit" className="btn btn--klein" title="Abmelden">
        <IconAbmelden size={15} />
        Abmelden
      </button>
    </form>
  )
}
