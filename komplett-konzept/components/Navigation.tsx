'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconAutomation,
  IconEinstellungen,
  IconFehler,
  IconLauf,
  IconNutzer,
  IconProtokoll,
  IconUebersicht,
} from './Icons'

const PUNKTE = [
  { gruppe: 'Betrieb', eintraege: [
    { href: '/', text: 'Übersicht', Icon: IconUebersicht },
    { href: '/automationen', text: 'Automationen', Icon: IconAutomation },
    { href: '/executions', text: 'Ausführungen', Icon: IconLauf },
    { href: '/fehler', text: 'Fehler', Icon: IconFehler, zaehler: 'fehler' as const },
  ]},
  { gruppe: 'Verwaltung', eintraege: [
    { href: '/protokoll', text: 'Protokoll', Icon: IconProtokoll },
    { href: '/nutzer', text: 'Nutzer', Icon: IconNutzer },
    { href: '/einstellungen', text: 'Einstellungen', Icon: IconEinstellungen },
  ]},
]

export function Navigation({ offeneFehler }: { offeneFehler: number }) {
  const pfad = usePathname()

  const istAktiv = (href: string) => (href === '/' ? pfad === '/' : pfad.startsWith(href))

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {PUNKTE.map((block) => (
        <div key={block.gruppe} style={{ display: 'contents' }}>
          <p className="nav__gruppe">{block.gruppe}</p>
          {block.eintraege.map(({ href, text, Icon, ...rest }) => {
            const zaehler = 'zaehler' in rest && rest.zaehler === 'fehler' ? offeneFehler : 0
            return (
              <Link
                key={href}
                href={href}
                className="nav__link"
                aria-current={istAktiv(href) ? 'page' : undefined}
              >
                <Icon />
                {text}
                {zaehler > 0 ? (
                  <span className="nav__zahl nav__zahl--alarm">{zaehler}</span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
