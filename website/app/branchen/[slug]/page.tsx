import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Figure } from '@/components/Figure'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { CtaBand, FaqSection } from '@/components/Sections'
import { branchen, getBranche } from '@/lib/branchen'
import { getReferenz } from '@/lib/referenzen'
import {
  JsonLd,
  breadcrumbJsonLd,
  brancheServiceJsonLd,
  faqPageJsonLd,
  pageMetadata,
} from '@/lib/seo'

export function generateStaticParams() {
  return branchen.map((b) => ({ slug: b.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const b = getBranche(params.slug)
  if (!b) return { title: 'Branche nicht gefunden' }

  return pageMetadata({
    title: b.metaTitle,
    description: b.metaDescription,
    path: `/branchen/${b.slug}`,
    keywords: b.keywords,
  })
}

export default function BranchePage({ params }: { params: { slug: string } }) {
  const branche = getBranche(params.slug)
  if (!branche) notFound()

  const referenz = branche.referenz ? getReferenz(branche.referenz) : undefined

  return (
    <>
      <PageHead
        crumb={branche.title}
        crumbTrail={[{ label: 'Branchen', href: '/branchen' }]}
        eyebrow="Branche"
        title={branche.title}
        lead={branche.teaser}
      />

      <div className="band">
        <Figure bild={branche.bild} priority sizes="100vw" />
      </div>

      {/* ---------------------------------------------- Einordnung */}
      <section className="section section--tight" aria-labelledby="einordnung-title">
        <div className="container container--narrow">
          <Reveal>
            <h2 className="section-title" id="einordnung-title">
              Warum sich das hier lohnt
            </h2>
            <p className="lead" style={{ marginTop: 'var(--s-4)' }}>
              {branche.intro}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------- Painpoints */}
      <section className="section section--paper" aria-labelledby="probleme-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Ausgangslage</p>
            <h2 className="section-title" id="probleme-title">
              Kommt Ihnen das bekannt vor?
            </h2>
          </Reveal>

          <ul className="pains">
            {branche.painpoints.map((p, i) => (
              <Reveal as="li" key={p} index={i} className="pain">
                <span className="pain__num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{p}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------- Lösungen */}
      <section className="section" aria-labelledby="loesungen-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Lösung</p>
            <h2 className="section-title" id="loesungen-title">
              Was ich für {branche.title} baue
            </h2>
          </Reveal>

          <ul className="grid-cards">
            {branche.loesungen.map((l, i) => (
              <Reveal as="li" key={l.title} index={i} className="card">
                <h3 className="card__title">{l.title}</h3>
                <p className="card__text">{l.text}</p>
              </Reveal>
            ))}
          </ul>

          <Reveal style={{ marginTop: 'var(--s-6)' }}>
            <h3 className="footer__heading">Typische Systeme</h3>
            <div className="tags">
              {branche.systeme.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------- Referenz */}
      {referenz ? (
        <section className="section section--paper" aria-labelledby="referenz-title">
          <div className="container container--narrow">
            <Reveal className="section-head">
              <p className="eyebrow">Referenzprojekt</p>
              <h2 className="section-title" id="referenz-title">
                Wie das in der Praxis aussieht
              </h2>
            </Reveal>

            <Reveal className="case">
              <p className="case__kicker">{referenz.brancheLabel}</p>
              <h3 className="case__title">
                <Link href={`/referenzprojekte/${referenz.slug}`} className="card__link">
                  {referenz.title}
                </Link>
              </h3>
              <p className="case__text">{referenz.teaser}</p>
              <span className="card__more">
                Projekt ansehen
                <Icon name="arrow" size={15} />
              </span>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------- FAQ */}
      {branche.faq.length > 0 ? (
        <FaqSection
          items={branche.faq}
          eyebrow="Häufige Fragen"
          title={`${branche.title} — häufige Fragen`}
        />
      ) : null}

      <CtaBand
        title={`Automatisierung für ${branche.title}?`}
        text="Beschreiben Sie im Erstgespräch Ihren Ablauf. Sie bekommen eine Einschätzung, was sich lohnt — und in welcher Reihenfolge."
      />

      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Branchen', path: '/branchen' },
          { name: branche.title, path: `/branchen/${branche.slug}` },
        ])}
      />
      <JsonLd data={brancheServiceJsonLd(branche)} />
      {branche.faq.length > 0 ? <JsonLd data={faqPageJsonLd(branche.faq)} /> : null}
    </>
  )
}
