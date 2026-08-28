'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { ersteinrichtung } from './actions'

type Zustand = { fehler?: string; name?: string; email?: string } | null

function Absenden() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn btn--primaer btn--voll" disabled={pending}>
      {pending ? 'Wird angelegt …' : 'Zugang anlegen und anmelden'}
    </button>
  )
}

export function EinrichtungsFormular() {
  const [zustand, aktion] = useFormState(ersteinrichtung, null as Zustand)

  const [name, setName] = useState(zustand?.name ?? '')
  const [email, setEmail] = useState(zustand?.email ?? '')
  const [passwort, setPasswort] = useState('')
  const [wiederholung, setWiederholung] = useState('')

  return (
    <form action={aktion} className="spalte" noValidate>
      {zustand?.fehler ? (
        <p className="meldung meldung--fehler" role="alert">{zustand.fehler}</p>
      ) : null}

      <div className="feld">
        <label htmlFor="name">Dein Name</label>
        <input id="name" name="name" type="text" required autoFocus autoComplete="name"
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="feld">
        <label htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" required autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="feld">
        <label htmlFor="passwort">Passwort</label>
        <input id="passwort" name="passwort" type="password" required minLength={10}
          autoComplete="new-password"
          value={passwort} onChange={(e) => setPasswort(e.target.value)} />
        <span className="feld__hinweis">Mindestens 10 Zeichen.</span>
      </div>

      <div className="feld">
        <label htmlFor="wiederholung">Passwort wiederholen</label>
        <input id="wiederholung" name="wiederholung" type="password" required
          autoComplete="new-password"
          value={wiederholung} onChange={(e) => setWiederholung(e.target.value)} />
      </div>

      <Absenden />
    </form>
  )
}
