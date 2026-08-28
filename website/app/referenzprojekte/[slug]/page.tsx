import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { CtaBand } from '@/components/Sections'
import { getBranche } from '@/lib/branchen'
import { getReferenz, referenzen } from '@/lib/referenzen'
import { JsonLd, breadcrumbJsonLd, caseStudyJsonLd, pageMetadata } from '@/lib/seo'

export function generateStaticParams() {
  return referenzen.map((r) => ({ slug: r.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const r = getReferenz(params.slug)
  if (!r) return { title: 'Projekt nicht gefunden' }

  return pageMetadata({
    title: r.metaTitle,
    description: r.metaDescription,
    path: `/referenzprojekte/${r.slug}`,
  })
}

export default function ReferenzPage({ params }: { params: { slug: string } }) {
  const referenz = getReferenz(params.slug)
  if (!referenz) notFound()

  const branche = referenz.brancheSlug ? getBranche(referenz.brancheSlug) : undefined

  return (
    <>
      <PageHead
        crumb={referenz.title}
        crumbTrail={[{ label: 'Referenzprojekte', href: '/referenzprojekte' }]}
        eyebrow={referenz.brancheLabel}
        title={referenz.title}
        lead={referenz.teaser}
      />

      <div className="section">
        <div className="container">
          <Reveal className="case-block">
            <h2 className="case-block__label">Ausgangslage</h2>
            <ul className="checklist">
              {referenz.ausgangslage.map((a) => (
                <li key={a}>
                  <Icon name="minus" size={16} />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="case-block">
            <h2 className="case-block__label">Vorgehen</h2>
            <ol className="numbered">
              {referenz.vorgehen.map((v) => (
                <li key={v.title}>
                  <div>
                    <h3>{v.title}</h3>
                    <p>{v.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal className="case-block">
            <h2 className="case-block__label">Ergebnis</h2>
            <ul className="checklist">
              {referenz.ergebnis.map((e) => (
                <li key={e}>
                  <Icon name="check" size={16} />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="case-block">
            <h2 className="case-block__label">Eingesetzte Technik</h2>
            <div>
              <div className="tags" style={{ marginTop: 0 }}>
                {referenz.stack.map((s) => (
                  <span className="tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              {branche ? (
                <p style={{ marginTop: 'var(--s-6)' }}>
                  <Link href={`/branchen/${branche.slug}`} className="link-arrow">
                    Mehr zu Automatisierung in {branche.title}
                    <Icon name="arrow" size={16} />
                  </Link>
                </p>
              ) : null}
            </div>
          </Reveal>
        </div>
      </div>

      <CtaBand
        title="So etwas für Ihren Betrieb?"
        text="Im Erstgespräch klären wir, ob sich Ihr Fall vergleichbar lösen lässt — und was ihn davon unterscheidet."
      />

      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Referenzprojekte', path: '/referenzprojekte' },
          { name: referenz.title, path: `/referenzprojekte/${referenz.slug}` },
        ])}
      />
      <JsonLd data={caseStudyJsonLd(referenz)} />
    </>
  )
}
