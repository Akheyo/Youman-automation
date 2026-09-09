'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { anmelden } from './actions'

function Absenden() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn btn--primaer btn--voll" disabled={pending}>
      {pending ? 'Wird geprüft …' : 'Anmelden'}
    </button>
  )
}

export function LoginFormular() {
  const [zustand, aktion] = useFormState(anmelden, null as { fehler?: string; email?: string } | null)

  // Bewusst gesteuerte Felder: nach einem Fehlversuch setzt React das Formular
  // sonst zurück und man müsste die E-Mail neu eintippen.
  const [email, setEmail] = useState(zustand?.email ?? '')
  const [passwort, setPasswort] = useState('')

  return (
    <form action={aktion} className="spalte" noValidate>
      {zustand?.fehler ? (
        <p className="meldung meldung--fehler" role="alert">
          {zustand.fehler}
        </p>
      ) : null}

      <div className="feld">
        <label htmlFor="email">E-Mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="name@komplett-konzept.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="feld">
        <label htmlFor="passwort">Passwort</label>
        <input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="current-password"
          required
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
        />
      </div>

      <Absenden />
    </form>
  )
}
