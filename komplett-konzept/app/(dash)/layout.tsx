import { Logo } from '@/components/Logo'
import { Navigation } from '@/components/Navigation'
import { AbmeldeKnopf } from '@/components/AbmeldeKnopf'
import { ROLLEN_LABEL } from '@/lib/auth'
import { nutzerErzwingen } from '@/lib/auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const nutzer = await nutzerErzwingen()
  const [{ n: offeneFehler }] = await sql<{ n: number }[]>`
    select count(*)::int as n from errors where status = 'open'
  `

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__marke">
          <Logo size={32} />
          <span>
            Komplett
            <em>Konzept</em>
          </span>
        </div>

        <Navigation offeneFehler={offeneFehler} />

        <div className="sidebar__fuss">
          <div style={{ fontWeight: 600, color: 'var(--text-gedaempft)' }}>{nutzer.name}</div>
          <div>{ROLLEN_LABEL[nutzer.role]}</div>
        </div>
      </aside>

      <div className="inhalt">
        <header className="kopf">
          <span className="kopf__titel">Automations-Dashboard</span>
          <div className="kopf__rechts">
            <span className="klein schwach" style={{ display: 'none' }} />
            <AbmeldeKnopf />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
