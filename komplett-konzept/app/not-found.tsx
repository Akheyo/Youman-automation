import Link from 'next/link'

export default function NichtGefunden() {
  return (
    <main className="login">
      <div className="login__karte" style={{ textAlign: 'center' }}>
        <h1>Seite nicht gefunden</h1>
        <p className="gedaempft klein">Diese Adresse gibt es nicht (mehr).</p>
        <Link href="/" className="btn btn--primaer btn--voll">Zur Übersicht</Link>
      </div>
    </main>
  )
}
