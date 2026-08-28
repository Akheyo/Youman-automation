import Link from 'next/link'
import { branchen } from '@/lib/branchen'
import { nav, site } from '@/lib/site'
import { Logo } from './Logo'

const legal = [
  { href: '/impressum', label: 'Impressum' },
  { href: '/datenschutz', label: 'Datenschutz' },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link href="/" aria-label={`${site.name} — zur Startseite`}>
              <Logo size="sm" />
            </Link>
            <p className="footer__blurb">
              Prozessautomatisierung, KI-Chatbots und Software-Schnittstellen für
              Mittelstand und Onlinehandel. Umgesetzt von einer Person, die den Code
              auch selbst schreibt.
            </p>
          </div>

          <nav aria-label="Branchen">
            <h2 className="footer__heading">Branchen</h2>
            <ul className="footer__list">
              {branchen.map((b) => (
                <li key={b.slug}>
                  <Link href={`/branchen/${b.slug}`} className="footer__link">
                    {b.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer-Navigation">
            <h2 className="footer__heading">Seiten</h2>
            <ul className="footer__list">
              {nav
                .filter((item) => item.href !== '/')
                .map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="footer__link">
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>

          <div>
            <h2 className="footer__heading">Kontakt</h2>
            <ul className="footer__list">
              <li>
                <a href={`mailto:${site.email}`} className="footer__link">
                  {site.email}
                </a>
              </li>
              <li>
                <a href={`tel:${site.phoneHref}`} className="footer__link">
                  {site.phone}
                </a>
              </li>
              <li>
                <a
                  href={site.whatsapp}
                  className="footer__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="footer__heading">Rechtliches</h2>
            <ul className="footer__list">
              {legal.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="footer__link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          <p>{site.location}</p>
        </div>
      </div>
    </footer>
  )
}
