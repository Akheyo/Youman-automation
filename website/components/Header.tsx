'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { nav, site } from '@/lib/site'
import { Icon } from './Icon'
import { Logo } from './Logo'

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Any route change closes the mobile panel.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Escape closes the panel and hands focus back to the toggle.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // "/" ist nur auf der Startseite aktiv; alle anderen auch auf ihren Unterseiten.
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className={`header${scrolled ? ' header--scrolled' : ''}`}>
      <div className="container header__inner">
        <Link href="/" aria-label={`${site.name} — zur Startseite`}>
          <Logo size="sm" />
        </Link>

        <nav className="header__nav" aria-label="Hauptnavigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="header__link"
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header__actions">
          <Link href="/kontakt" className="btn btn--primary header__cta">
            Projekt anfragen
          </Link>

          <button
            ref={toggleRef}
            type="button"
            className="header__burger"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
            onClick={() => setOpen((value) => !value)}
          >
            <span className={`burger${open ? ' burger--open' : ''}`} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div id="mobile-nav" className="mobile-nav" hidden={!open}>
        <div className="container mobile-nav__inner">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-nav__link"
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
              <Icon name="arrow" size={18} />
            </Link>
          ))}
          <Link href="/kontakt" className="btn btn--primary btn--block">
            Projekt anfragen
          </Link>
        </div>
      </div>
    </header>
  )
}
