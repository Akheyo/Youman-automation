'use client'

import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { nutzerAnlegen } from './actions'

function Absenden() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn btn--primaer" disabled={pending}>
      {pending ? 'Wird angelegt …' : 'Nutzer anlegen'}
    </button>
  )
}

const LEER = { name: '', email: '', rolle: 'viewer', passwort: '' }

export function NutzerFormular() {
  const [zustand, aktion] = useFormState(
    nutzerAnlegen,
    null as { fehler?: string; ok?: string } | null,
  )

  // Gesteuerte Felder: bei einem Fehler bleiben die Eingaben stehen,
  // nach dem Anlegen wird geleert.
  const [werte, setWerte] = useState(LEER)
  useEffect(() => {
    if (zustand?.ok) setWerte(LEER)
  }, [zustand])

  const ändern = (feld: keyof typeof LEER) => (e: { target: { value: string } }) =>
    setWerte((w) => ({ ...w, [feld]: e.target.value }))

  return (
    <form action={aktion} className="spalte">
      {zustand?.fehler ? <p className="meldung meldung--fehler" role="alert">{zustand.fehler}</p> : null}
      {zustand?.ok ? <p className="meldung meldung--ok" role="status">{zustand.ok}</p> : null}

      <div className="feld">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required autoComplete="off"
          value={werte.name} onChange={ändern('name')} />
      </div>

      <div className="feld">
        <label htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" required autoComplete="off"
          value={werte.email} onChange={ändern('email')} />
      </div>

      <div className="feld">
        <label htmlFor="rolle">Rolle</label>
        <select id="rolle" name="rolle" value={werte.rolle} onChange={ändern('rolle')}>
          <option value="viewer">Betrachter — sieht alles, steuert nichts</option>
          <option value="operator">Bediener — darf starten, pausieren, Fehler erledigen</option>
          <option value="admin">Administrator — darf zusätzlich Nutzer verwalten</option>
        </select>
      </div>

      <div className="feld">
        <label htmlFor="passwort">Erstes Passwort</label>
        <input id="passwort" name="passwort" type="text" required minLength={10} autoComplete="off"
          value={werte.passwort} onChange={ändern('passwort')} />
        <span className="feld__hinweis">Mindestens 10 Zeichen. Gib es der Person persönlich weiter.</span>
      </div>

      <Absenden />
    </form>
  )
}
