import Link from 'next/link'
import { Figure } from '@/components/Figure'
import { HeroVideo } from '@/components/HeroVideo'
import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import { AussageBand, SplitRaster } from '@/components/Muster'
import { CtaBand } from '@/components/Sections'
import { branchen } from '@/lib/branchen'
import { videoQuellen } from '@/lib/dateien'
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

const kennzahlen = [
  { value: '24 h', label: 'Maximale Antwortzeit auf Anfragen' },
  { value: '6', label: 'Branchen mit ausgearbeiteten Anwendungsfällen' },
  { value: '1', label: 'Ansprechpartner vom Angebot bis zum Betrieb' },
]

/**
 * Aufbau nach dem Muster "Enterprise Gateway" aus dem UI/UX-Skill:
 * Hero → Belege → Lösungen nach Branche → Leistungen → Referenzen → Kontakt.
 *
 * Bewusst sechs Sektionen. Die frühere Fassung hatte acht, davon zwei mit
 * derselben Aussage; Ablauf und Bereichsliste stehen jetzt dort, wo sie
 * hingehören — auf /leistungen und /branchen.
 */
export default function HomePage() {
  const topReferenzen = referenzen.slice(0, 2)

  return (
    <>
      {/* ---------------------------------------------- Hero */}
      <section className="hero-ed on-dark" aria-labelledby="hero-title">
        <div className="container hero-ed__inner">
          <div>
            <Reveal className="hero-ed__status">
              <span className="status-dot" aria-hidden="true" />
              Verfügbar für neue Projekte
            </Reveal>

            <Reveal index={1}>
              <h1 className="hero-ed__title" id="hero-title">
                Prozesse, die heute Menschen kosten, laufen morgen allein.
              </h1>
              <p className="hero-ed__lead">
                Wir verbinden Ihre Systeme, automatisieren wiederkehrende Abläufe und
                bauen KI-Anwendungen, die im Tagesgeschäft standhalten — für
                Onlinehandel, Logistik, Produktion und Großhandel.
              </p>
            </Reveal>

            <Reveal index={2} className="hero-ed__actions">
              <Link href="/kontakt" className="btn btn--invert">
                Kostenloses Erstgespräch
                <Icon name="arrow" size={16} />
              </Link>
              <Link href="/branchen" className="btn btn--outline-invert">
                Branchen ansehen
              </Link>
            </Reveal>

            <Reveal index={3}>
              <p className="hero-ed__note">
                Unverbindlich · Antwort innerhalb von {site.responseTime}
              </p>
            </Reveal>
          </div>

          <Reveal index={2}>
            <HeroVideo
              video="hero"
              quellen={videoQuellen('hero')}
              ersatzbild={
                <Figure bild="heroStart" priority sizes="(min-width: 1000px) 45vw, 100vw" />
              }
            />
          </Reveal>
        </div>

        <div className="container figures-bar">
          <Reveal as="dl" className="figures-bar__grid">
            {kennzahlen.map((k) => (
              <div className="figures-bar__item" key={k.value}>
                <dt className="figures-bar__label">{k.label}</dt>
                <dd className="figures-bar__value">{k.value}</dd>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------- Branchen mit Bild */}
      <section className="section" aria-labelledby="branchen-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Branchen</p>
            <h2 className="section-title" id="branchen-title">
              Automatisierung ist kein Selbstzweck
            </h2>
            <p className="lead">
              Was sich lohnt, hängt vom Geschäft ab. Deshalb nach Branche sortiert — mit
              den Problemen, die dort tatsächlich anfallen.
            </p>
          </Reveal>

          <ul className="grid-cards grid-cards--3">
            {branchen.map((b, i) => (
              <Reveal as="li" key={b.slug} index={i} className="card card--link card--bild">
                <Figure
                  bild={b.bild}
                  sizes="(min-width: 1000px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
                <div className="card__body">
                  <h3 className="card__title">
                    <Link href={`/branchen/${b.slug}`} className="card__link">
                      {b.title}
                    </Link>
                  </h3>
                  <p className="card__text">{b.teaser}</p>
                  <span className="card__more">Anwendungsfälle</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------- Leistungen */}
      <SplitRaster
        label="Automatisierung. Software. Integration."
        titel="Wir beraten, wo andere nur liefern — und bauen, was andere nur empfehlen."
        aktion={{ href: '/leistungen', label: 'Wie wir arbeiten' }}
        eintraege={services.map((service) => ({
          nummer: service.index,
          titel: service.title,
          text: service.teaser,
          href: `/leistungen#${service.slug}`,
        }))}
      />

      {/* ---------------------------------------------- Aussage */}
      <AussageBand
        bild="statement"
        zeilen={['Kein Systemwechsel.', 'Keine Medienbrüche.', 'Eine Oberfläche.']}
        text="Ihre Mitarbeitenden sehen eine Oberfläche. Datenabruf, Berechnung und Abgleich mit dem bestehenden System laufen vollautomatisch im Hintergrund."
      />

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
              <Reveal as="li" key={r.slug} index={i} className="card card--link card--bild">
                <Figure bild={r.bild} sizes="(min-width: 640px) 50vw, 100vw" />
                <div className="card__body">
                  <p className="case__kicker">{r.brancheLabel}</p>
                  <h3 className="card__title">
                    <Link href={`/referenzprojekte/${r.slug}`} className="card__link">
                      {r.title}
                    </Link>
                  </h3>
                  <p className="card__text">{r.teaser}</p>
                  <span className="card__more">Projekt ansehen</span>
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

      <CtaBand />
    </>
  )
}
