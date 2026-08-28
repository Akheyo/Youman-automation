import Link from 'next/link'
import { Reveal } from './Reveal'

export function PageHead({
  eyebrow,
  title,
  lead,
  crumb,
}: {
  eyebrow: string
  title: string
  lead?: string
  crumb: string
}) {
  return (
    <section className="page-head">
      <div className="container">
        <Reveal>
          <nav aria-label="Brotkrumen">
            <ol className="crumbs">
              <li>
                <Link href="/">Startseite</Link>
              </li>
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
