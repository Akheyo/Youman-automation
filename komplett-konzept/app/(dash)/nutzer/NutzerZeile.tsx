'use client'

import { useTransition } from 'react'
import { nutzerUmschalten, rolleAendern } from './actions'
import type { Nutzer, Rolle } from '@/lib/types'

export function NutzerAktionen({ nutzer, istIchSelbst }: { nutzer: Nutzer; istIchSelbst: boolean }) {
  const [laeuft, start] = useTransition()

  return (
    <div className="btn-reihe">
      <select
        aria-label={'Rolle von ' + nutzer.name}
        defaultValue={nutzer.role}
        disabled={laeuft || istIchSelbst}
        style={{ minHeight: 30, fontSize: 12.5, width: 'auto', padding: '4px 28px 4px 8px' }}
        onChange={(e) => start(() => rolleAendern(nutzer.id, e.target.value as Rolle).catch(() => {}))}
      >
        <option value="viewer">Betrachter</option>
        <option value="operator">Bediener</option>
        <option value="admin">Administrator</option>
      </select>

      <button
        type="button"
        className={'btn btn--klein' + (nutzer.is_active ? ' btn--gefahr' : ' btn--erfolg')}
        disabled={laeuft || istIchSelbst}
        onClick={() => start(() => nutzerUmschalten(nutzer.id, !nutzer.is_active).catch(() => {}))}
      >
        {nutzer.is_active ? 'Deaktivieren' : 'Aktivieren'}
      </button>
    </div>
  )
}
