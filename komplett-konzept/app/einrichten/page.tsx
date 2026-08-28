import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { sql } from '@/lib/db'
import { EinrichtungsFormular } from './EinrichtungsFormular'

export const metadata = { title: 'Einrichten' }
export const dynamic = 'force-dynamic'

export default async function EinrichtenSeite() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users`

  // Sobald es einen Zugang gibt, ist diese Seite geschlossen.
  if (n > 0) redirect('/login')

  return (
    <main className="login">
      <div className="login__karte">
        <div className="login__marke">
          <Logo size={48} />
          <div>
            <h1 style={{ fontSize: 18 }}>Komplett Konzept</h1>
            <p>Ersteinrichtung</p>
          </div>
        </div>

        <p className="meldung meldung--info klein">
          Es gibt noch keinen Zugang. Lege hier den ersten Administrator an —
          danach ist diese Seite geschlossen und weitere Nutzer werden im
          Dashboard verwaltet.
        </p>

        <EinrichtungsFormular />
      </div>
    </main>
  )
}
