import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { sql } from '@/lib/db'
import { aktuellerNutzer } from '@/lib/session'
import { LoginFormular } from './LoginFormular'

export const metadata = { title: 'Anmelden' }
export const dynamic = 'force-dynamic'

export default async function LoginSeite() {
  if (await aktuellerNutzer()) redirect('/')

  // Frische Installation: es gibt noch niemanden, der sich anmelden koennte.
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users`
  if (n === 0) redirect('/einrichten')

  return (
    <main className="login">
      <div className="login__karte">
        <div className="login__marke">
          <Logo size={48} />
          <div>
            <h1 style={{ fontSize: 18 }}>Komplett Konzept</h1>
            <p>Automations-Dashboard</p>
          </div>
        </div>

        <LoginFormular />

        <p className="schwach klein" style={{ textAlign: 'center' }}>
          Kein Zugang? Ein Administrator legt dich unter „Nutzer“ an.
        </p>
      </div>
    </main>
  )
}
