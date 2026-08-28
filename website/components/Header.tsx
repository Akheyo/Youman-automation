'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { branchen } from '@/lib/branchen'
import { nav, services, site } from '@/lib/site'
import { Icon } from './Icon'
import { Logo } from './Logo'

/** Untereinträge aus den Datenquellen — eine neue Branche steht sofort im Menü. */
const untermenues: Record<string, { href: string; label: string }[]> = {
  '/branchen': branchen.map((b) => ({ href: `/branchen/${b.slug}`, label: b.title })),
  '/leistungen': services.map((s) => ({
    href: `/leistungen#${s.slug}`,
    label: s.title,
  })),
}

export function Header() {
  const pathname = usePathname()
  const [offen, setOffen] = useState(false)
  const [aufgeklappt, setAufgeklappt] = useState<string | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const schliessZeit = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setOffen(false)
    setAufgeklappt(null)
  }, [pathname])

  // Escape schließt beides und gibt den Fokus zurück.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (aufgeklappt) setAufgeklappt(null)
      else if (offen) {
        setOffen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [offen, aufgeklappt])

  // Klick außerhalb schließt das Untermenü.
  useEffect(() => {
    if (!aufgeklappt) return
    const onClick = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setAufgeklappt(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [aufgeklappt])

  const istAktiv = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  /* Kurze Verzögerung beim Verlassen: sonst klappt das Menü zu, während die
     Maus die Lücke zwischen Beschriftung und Liste überquert. */
  function oeffnen(href: string) {
    clearTimeout(schliessZeit.current)
    setAufgeklappt(href)
  }
  function spaeterSchliessen() {
    clearTimeout(schliessZeit.current)
    schliessZeit.current = setTimeout(() => setAufgeklappt(null), 140)
  }

  return (
    <header className="header">
      <div className="container header__inner">
        <Link href="/" aria-label={`${site.name} — zur Startseite`}>
          <Logo size="sm" />
        </Link>

        <nav className="header__nav" aria-label="Hauptnavigation" ref={navRef}>
          {nav.map((eintrag) => {
            const unter = untermenues[eintrag.href]
            const aktiv = istAktiv(eintrag.href)

            if (!unter) {
              return (
                <Link
                  key={eintrag.href}
                  href={eintrag.href}
                  className="header__link"
                  aria-current={aktiv ? 'page' : undefined}
                >
                  {eintrag.label}
                </Link>
              )
            }

            const istOffen = aufgeklappt === eintrag.href

            return (
              <div
                key={eintrag.href}
                className="header__gruppe"
                onMouseEnter={() => oeffnen(eintrag.href)}
                onMouseLeave={spaeterSchliessen}
              >
                <Link
                  href={eintrag.href}
                  className="header__link header__link--gruppe"
                  aria-current={aktiv ? 'page' : undefined}
                  aria-expanded={istOffen}
                  aria-haspopup="true"
                  onFocus={() => oeffnen(eintrag.href)}
                  onClick={() => setAufgeklappt(null)}
                >
                  {eintrag.label}
                  <span className={`header__chevron${istOffen ? ' is-open' : ''}`} aria-hidden="true" />
                </Link>

                <div className="header__untermenue" hidden={!istOffen}>
                  <ul>
                    {unter.map((u) => (
                      <li key={u.href}>
                        <Link href={u.href} className="header__unterlink">
                          {u.label}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link href={eintrag.href} className="header__unterlink header__unterlink--alle">
                        Alle {eintrag.label}
                        <Icon name="arrow" size={15} />
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="header__actions">
          <Link href="/kontakt" className="btn btn--primary header__cta">
            Projekt anfragen
          </Link>

          <button
            ref={toggleRef}
            type="button"
            className="header__burger"
            aria-expanded={offen}
            aria-controls="mobile-nav"
            aria-label={offen ? 'Menü schließen' : 'Menü öffnen'}
            onClick={() => setOffen((v) => !v)}
          >
            <span className={`burger${offen ? ' burger--open' : ''}`} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div id="mobile-nav" className="mobile-nav" hidden={!offen}>
        <div className="container mobile-nav__inner">
          {nav.map((eintrag) => {
            const unter = untermenues[eintrag.href]
            return (
              <div key={eintrag.href}>
                <Link
                  href={eintrag.href}
                  className="mobile-nav__link"
                  aria-current={istAktiv(eintrag.href) ? 'page' : undefined}
                >
                  {eintrag.label}
                  <Icon name="arrow" size={18} />
                </Link>
                {unter ? (
                  <ul className="mobile-nav__unter">
                    {unter.map((u) => (
                      <li key={u.href}>
                        <Link href={u.href} className="mobile-nav__unterlink">
                          {u.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
          <Link href="/kontakt" className="btn btn--primary btn--block">
            Projekt anfragen
          </Link>
        </div>
      </div>
    </header>
  )
}
