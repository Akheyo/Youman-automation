import Link from 'next/link'
import { Accordion } from '@/components/Accordion'
import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import {
  ComparisonSection,
  CtaBand,
  ProcessSection,
  TestimonialsSection,
  ToolMarquee,
} from '@/components/Sections'
import { JsonLd, faqJsonLd, pageMetadata } from '@/lib/seo'
import { faq, projects, services, site } from '@/lib/site'

export const metadata = pageMetadata({
  title: `${site.fullName} — KI-Automationen, Chatbots & Websites`,
  description: site.description,
  path: '/',
})

const metrics = [
  { value: '24 h', label: 'Maximale Antwortzeit auf Anfragen' },
  { value: '4', label: 'Kernleistungen aus einer Hand' },
  { value: '1', label: 'Ansprechpartner — vom Angebot bis zum Support' },
  { value: '0 €', label: 'Kosten für das Erstgespräch' },
]

export default function HomePage() {
  return (
    <>
      {/* ---------------------------------------------- Hero */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__inner">
          <Reveal className="hero__status">
            <span className="status-dot" aria-hidden="true" />
            Verfügbar für neue Projekte
          </Reveal>

          <Reveal index={1}>
            <h1 className="hero__title" id="hero-title">
              Software und KI, die <em>Arbeit abnimmt</em>.
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="hero__lead">
              Ich baue Automationen, Chatbots und Websites für Unternehmen, die genug
              davon haben, dass Menschen Daten von A nach B kopieren. Technisch sauber,
              verständlich erklärt, direkt mit mir.
            </p>
          </Reveal>

          <Reveal index={3} className="hero__actions">
            <Link href="/kontakt" className="btn btn--primary">
              Kostenloses Erstgespräch
              <Icon name="arrow" size={16} />
            </Link>
            <Link href="/leistungen" className="btn btn--ghost">
              Leistungen ansehen
            </Link>
          </Reveal>
        </div>

        <div className="container" style={{ marginTop: 'var(--s-8)' }}>
          <Reveal as="dl" className="metrics">
            {metrics.map((metric, i) => (
              // Term before definition in the DOM for screen readers; CSS flips the
              // pair visually so the number leads.
              <div className="metric" key={metric.value + i}>
                <dt className="metric__label">{metric.label}</dt>
                <dd className="metric__value">{metric.value}</dd>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------- Tools */}
      <section className="section--tight" aria-label="Eingesetzte Technologien">
        <ToolMarquee />
      </section>

      {/* ---------------------------------------------- Leistungen */}
      <section className="section" aria-labelledby="leistungen-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Leistungen</p>
            <h2 className="section-title" id="leistungen-title">
              Vier Bereiche, ein Ansprechpartner
            </h2>
            <p className="lead">
              Kein Outsourcing, keine Weitergabe an Dritte. Was ich anbiete, setze ich
              auch selbst um — deshalb ist die Liste bewusst kurz.
            </p>
          </Reveal>

          <div className="services">
            {services.map((service, i) => (
              <Reveal key={service.slug} index={i} className="service">
                <span className="service__index">{service.index}</span>

                <div className="service__head">
                  <h3 className="service__title">{service.title}</h3>
                  <p className="service__teaser" style={{ marginTop: 'var(--s-3)' }}>
                    {service.teaser}
                  </p>
                  <div className="tags">
                    {service.stack.map((item) => (
                      <span className="tag" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="service__body">
                  <ul className="service__list">
                    {service.outcomes.map((outcome) => (
                      <li key={outcome}>
                        <Icon name="check" size={16} />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                  <p style={{ marginTop: 'var(--s-5)' }}>
                    <Link href={`/leistungen#${service.slug}`} className="link-arrow">
                      Details
                      <Icon name="arrow" size={16} />
                    </Link>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- Ablauf */}
      <ProcessSection />

      {/* ---------------------------------------------- Arbeiten */}
      <section className="section" aria-labelledby="arbeiten-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Referenzen</p>
            <h2 className="section-title" id="arbeiten-title">
              Ausgewählte Projekte
            </h2>
            <p className="lead">
              Vier Beispiele dafür, wie die Bereiche in der Praxis zusammenspielen.
            </p>
          </Reveal>

          <ul className="work">
            {projects.map((project, i) => (
              <Reveal as="li" key={project.title} index={i} className="work__item">
                <p className="work__kicker">{project.kicker}</p>
                <h3 className="work__title">{project.title}</h3>
                <p className="work__text">{project.text}</p>
                <div className="tags">
                  {project.stack.map((item) => (
                    <span className="tag" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </Reveal>
            ))}
          </ul>

          <Reveal style={{ marginTop: 'var(--s-7)' }}>
            <Link href="/referenzen" className="btn btn--ghost">
              Alle Referenzen ansehen
              <Icon name="arrow" size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------- Stimmen */}
      <TestimonialsSection />

      {/* ---------------------------------------------- Vergleich */}
      <ComparisonSection />

      {/* ---------------------------------------------- FAQ */}
      <section className="section" aria-labelledby="faq-title">
        <div className="container container--narrow">
          <Reveal className="section-head">
            <p className="eyebrow">Häufige Fragen</p>
            <h2 className="section-title" id="faq-title">
              Das Wichtigste vorab
            </h2>
          </Reveal>
          <Reveal>
            <Accordion items={faq} />
          </Reveal>
        </div>
      </section>

      <CtaBand />
      <JsonLd data={faqJsonLd()} />
    </>
  )
}
