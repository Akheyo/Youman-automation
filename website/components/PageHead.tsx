import Link from 'next/link'
import { Reveal } from './Reveal'

export function PageHead({
  eyebrow,
  title,
  lead,
  crumb,
  crumbTrail = [],
}: {
  eyebrow: string
  title: string
  lead?: string
  /** Letzter, nicht verlinkter Eintrag der Brotkrumen. */
  crumb: string
  /** Zwischenstufen zwischen Startseite und aktueller Seite. */
  crumbTrail?: { label: string; href: string }[]
}) {
  return (
    <section className="page-head">
      <div className="container">
        <Reveal>
          <nav aria-label="Brotkrumen">
            <ol className="crumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              {crumbTrail.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li aria-current="page">{crumb}</li>
            </ol>
          </nav>
          <p className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>
            {eyebrow}
          </p>
          <h1 className="page-head__title">{title}</h1>
          {lead ? <p className="page-head__lead">{lead}</p> : null}
        </Reveal>
      </div>
    </section>
  )
}
