import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { CtaBand } from '@/components/Sections'
import { branchen } from '@/lib/branchen'
import { JsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Branchen',
  description:
    'Automatisierung nach Branche: E-Commerce, Spedition und Logistik, Produktion, Großhandel, Handwerk und Dienstleistung. Mit den Problemen, die dort tatsächlich anfallen.',
  path: '/branchen',
  keywords: [
    'Automatisierung Branchen',
    'Prozessautomatisierung Mittelstand',
    'KI Anwendungsfälle Branche',
  ],
})

export default function BranchenPage() {
  return (
    <>
      <PageHead
        crumb="Branchen"
        eyebrow="Branchen"
        title="Wo Automatisierung sich tatsächlich rechnet"
        lead="Ein Bestandsabgleich im Onlinehandel hat mit einer Auftragserfassung in der Spedition wenig gemeinsam. Deshalb ist hier nach Branche sortiert, was ich dort konkret baue."
      />

      <section className="section" aria-label="Branchenübersicht">
        <div className="container">
          <ul className="grid-cards grid-cards--3">
            {branchen.map((b, i) => (
              <Reveal as="li" key={b.slug} index={i} className="card card--link">
                <h2 className="card__title">
                  <Link href={`/branchen/${b.slug}`} className="card__link">
                    {b.title}
                  </Link>
                </h2>
                <p className="card__text">{b.teaser}</p>
                <span className="card__more">
                  Anwendungsfälle
                  <Icon name="arrow" size={15} />
                </span>
              </Reveal>
            ))}
          </ul>

          <Reveal style={{ marginTop: 'var(--s-7)' }}>
            <p className="lead">
              Ihre Branche ist nicht dabei? Die Muster wiederholen sich stärker, als man
              denkt — Daten liegen im falschen System, ein Mensch überträgt sie.{' '}
              <Link href="/kontakt" className="link-arrow">
                Beschreiben Sie Ihren Fall
                <Icon name="arrow" size={16} />
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <CtaBand />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Branchen', path: '/branchen' }])} />
    </>
  )
}
