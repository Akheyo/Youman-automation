'use client'

export default function Fehlerseite({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="login">
      <div className="login__karte">
        <h1>Da ist etwas schiefgelaufen</h1>
        <p className="meldung meldung--fehler klein">{error.message}</p>
        <button type="button" className="btn btn--primaer btn--voll" onClick={reset}>
          Nochmal versuchen
        </button>
      </div>
    </main>
  )
}
