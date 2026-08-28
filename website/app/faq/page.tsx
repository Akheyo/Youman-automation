import Link from 'next/link'
import { Accordion } from '@/components/Accordion'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { CtaBand } from '@/components/Sections'
import { alleFragen, faqGruppen } from '@/lib/faq'
import { JsonLd, breadcrumbJsonLd, faqPageJsonLd, pageMetadata } from '@/lib/seo'
import { site } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Häufige Fragen',
  description:
    'Was kostet eine Automatisierung, wie lange dauert sie, muss das ERP gewechselt werden, wie steht es um DSGVO und Datenverarbeitung — Antworten auf die Fragen, die vor einem Projekt wirklich gestellt werden.',
  path: '/faq',
  keywords: [
    'Automatisierung Kosten',
    'Prozessautomatisierung Dauer',
    'KI-Chatbot DSGVO',
    'ERP Schnittstelle ohne Systemwechsel',
    'Make.com oder n8n',
    'Automatisierung kleine Unternehmen',
  ],
})

export default function FaqPage() {
  return (
    <>
      <PageHead
        crumb="Häufige Fragen"
        eyebrow="FAQ"
        title="Fragen, die vor einem Projekt wirklich gestellt werden"
        lead="Kosten, Dauer, Technik, Datenschutz. Wenn Ihre Frage fehlt, stellen Sie sie uns direkt — die Antwort landet dann meist hier."
      />

      {/* Sprungmarken: bei zwanzig Fragen sucht niemand von oben nach unten. */}
      <nav className="faq-sprung" aria-label="Themen">
        <div className="container">
          <ul>
            {faqGruppen.map((gruppe) => (
              <li key={gruppe.slug}>
                <a href={`#${gruppe.slug}`}>{gruppe.titel}</a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {faqGruppen.map((gruppe, i) => (
        <section
          key={gruppe.slug}
          id={gruppe.slug}
          className={i % 2 === 1 ? 'section section--paper' : 'section'}
          aria-labelledby={`${gruppe.slug}-titel`}
        >
          <div className="container container--narrow">
            <Reveal className="section-head">
              <p className="eyebrow">{String(i + 1).padStart(2, '0')}</p>
              <h2 className="section-title" id={`${gruppe.slug}-titel`}>
                {gruppe.titel}
              </h2>
            </Reveal>
            <Reveal>
              <Accordion items={gruppe.fragen} />
            </Reveal>
          </div>
        </section>
      ))}

      <section className="section" aria-labelledby="faq-rest-titel">
        <div className="container container--narrow">
          <Reveal>
            <h2 className="section-title" id="faq-rest-titel">
              Frage nicht dabei?
            </h2>
            <p className="lead" style={{ marginTop: 'var(--s-4)' }}>
              Schreiben Sie sie uns. Sie bekommen innerhalb von {site.responseTime} eine
              Antwort — auch dann, wenn sie lautet, dass sich etwas nicht lohnt.
            </p>
            <p style={{ marginTop: 'var(--s-5)' }}>
              <Link href="/kontakt" className="link-arrow">
                Frage stellen
                <Icon name="arrow" size={16} />
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <CtaBand />

      <JsonLd data={breadcrumbJsonLd([{ name: 'Häufige Fragen', path: '/faq' }])} />
      {/* Zulässig, weil alle Fragen und Antworten auf dieser Seite sichtbar sind. */}
      <JsonLd data={faqPageJsonLd(alleFragen)} />
    </>
  )
}
