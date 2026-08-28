import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import { CtaBand } from '@/components/Sections'
import { branchen } from '@/lib/branchen'
import { referenzen } from '@/lib/referenzen'
import { pageMetadata } from '@/lib/seo'
import { services, site } from '@/lib/site'

export const metadata = pageMetadata({
  title: `${site.fullName} — Prozesse automatisieren mit KI und Software`,
  description: site.description,
  path: '/',
  keywords: [
    'Prozessautomatisierung',
    'KI-Automatisierung Mittelstand',
    'Make.com Freelancer',
    'n8n Entwickler',
    'KI-Chatbot entwickeln lassen',
    'Schnittstelle ERP Shop',
  ],
})

const proof = [
  { value: '24 h', label: 'Maximale Antwortzeit auf Anfragen' },
  { value: '6', label: 'Branchen mit belegten Anwendungsfällen' },
  { value: '1', label: 'Ansprechpartner vom Angebot bis zum Betrieb' },
]

const ablauf = [
  {
    step: '01',
    title: 'Prozess ansehen',
    text: 'Kostenloses Erstgespräch. Ich schaue mir den Ablauf an und sage, was sich lohnt — und was nicht.',
  },
  {
    step: '02',
    title: 'Festes Angebot',
    text: 'Fixer Umfang, fester Termin, fester Preis. Kein Stundenzettel, keine Überraschung.',
  },
  {
    step: '03',
    title: 'Bauen und übergeben',
    text: 'Umsetzung mit Zwischenständen, dann Übergabe mit Dokumentation. Danach bleibe ich erreichbar.',
  },
]

export default function HomePage() {
  const topReferenzen = referenzen.slice(0, 2)

  return (
    <>
      {/* ---------------------------------------------- Hero */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__inner">
          <div>
            <Reveal className="hero__status">
              <span className="status-dot" aria-hidden="true" />
              Verfügbar für neue Projekte
            </Reveal>

            <Reveal index={1}>
              <h1 className="hero__title" id="hero-title">
                Prozesse, die heute Menschen kosten, laufen morgen allein.
              </h1>
              <p className="hero__lead">
                Ich verbinde Ihre Systeme, automatisiere wiederkehrende Abläufe und baue
                KI-Anwendungen, die im Tagesgeschäft standhalten. Für Onlinehandel,
                Logistik, Produktion und alle, die zu viel Zeit in Datenpflege stecken.
              </p>
            </Reveal>

            <Reveal index={2} className="hero__actions">
              <Link href="/kontakt" className="btn btn--primary">
                Kostenloses Erstgespräch
                <Icon name="arrow" size={16} />
              </Link>
              <Link href="/branchen" className="btn btn--ghost">
                Branchen ansehen
              </Link>
            </Reveal>

            <Reveal index={3}>
              <p className="hero__note">
                Erstgespräch unverbindlich · Antwort innerhalb von {site.responseTime}
              </p>
            </Reveal>
          </div>

          <Reveal index={2} className="hero__aside">
            <div className="proof">
              <h2 className="proof__title">Zusammenarbeit in Zahlen</h2>
              <dl className="proof__list">
                {proof.map((item) => (
                  <div className="proof__item" key={item.value}>
                    <dd className="proof__value">{item.value}</dd>
                    <dt className="proof__label">{item.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------- Branchen */}
      <section className="section" aria-labelledby="branchen-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Branchen</p>
            <h2 className="section-title" id="branchen-title">
              Automatisierung ist kein Selbstzweck
            </h2>
            <p className="lead">
              Was sich lohnt, hängt vom Geschäft ab. Deshalb hier nach Branche sortiert —
              mit den Problemen, die dort tatsächlich anfallen.
            </p>
          </Reveal>

          <ul className="grid-cards grid-cards--3">
            {branchen.map((b, i) => (
              <Reveal as="li" key={b.slug} index={i} className="card card--link">
                <h3 className="card__title">
                  <Link href={`/branchen/${b.slug}`} className="card__link">
                    {b.title}
                  </Link>
                </h3>
                <p className="card__text">{b.teaser}</p>
                <span className="card__more">
                  Anwendungsfälle
                  <Icon name="arrow" size={15} />
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------- Leistungen kompakt */}
      <section className="section section--paper" aria-labelledby="leistungen-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Leistungen</p>
            <h2 className="section-title" id="leistungen-title">
              Vier Bereiche, ein Ansprechpartner
            </h2>
          </Reveal>

          <ul className="grid-cards">
            {services.map((service, i) => (
              <Reveal as="li" key={service.slug} index={i} className="card card--link">
                <span className="card__icon">
                  <Icon name={service.icon} size={22} />
                </span>
                <h3 className="card__title">
                  <Link href={`/leistungen#${service.slug}`} className="card__link">
                    {service.title}
                  </Link>
                </h3>
                <p className="card__text">{service.teaser}</p>
                <span className="card__more">
                  Details
                  <Icon name="arrow" size={15} />
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------- Referenzprojekte */}
      <section className="section" aria-labelledby="referenzen-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Referenzprojekte</p>
            <h2 className="section-title" id="referenzen-title">
              Gebaut, im Einsatz, nachvollziehbar
            </h2>
          </Reveal>

          <ul className="grid-cards">
            {topReferenzen.map((r, i) => (
              <Reveal as="li" key={r.slug} index={i} className="case">
                <p className="case__kicker">{r.brancheLabel}</p>
                <h3 className="case__title">
                  <Link href={`/referenzprojekte/${r.slug}`} className="card__link">
                    {r.title}
                  </Link>
                </h3>
                <p className="case__text">{r.teaser}</p>
                <div className="tags">
                  {r.stack.slice(0, 4).map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </Reveal>
            ))}
          </ul>

          <Reveal style={{ marginTop: 'var(--s-6)' }}>
            <Link href="/referenzprojekte" className="link-arrow">
              Alle Referenzprojekte
              <Icon name="arrow" size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------- Ablauf */}
      <section className="section section--paper" aria-labelledby="ablauf-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Ablauf</p>
            <h2 className="section-title" id="ablauf-title">
              Drei Schritte bis zum laufenden System
            </h2>
          </Reveal>

          <ol className="steps">
            {ablauf.map((s, i) => (
              <Reveal as="li" key={s.step} index={i} className="step">
                <span className="step__num">{s.step}</span>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__text">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand />
    </>
  )
}
