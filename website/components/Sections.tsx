import Link from 'next/link'
import { Icon } from './Icon'
import { Reveal } from './Reveal'
import { comparison, processSteps, site, testimonials, tools } from '@/lib/site'

export function SectionHead({
  eyebrow,
  title,
  lead,
  as: Heading = 'h2',
}: {
  eyebrow: string
  title: string
  lead?: string
  as?: 'h1' | 'h2'
}) {
  return (
    <Reveal className="section-head">
      <p className="eyebrow">{eyebrow}</p>
      <Heading className="section-title">{title}</Heading>
      {lead ? <p className="lead">{lead}</p> : null}
    </Reveal>
  )
}

export function ToolMarquee() {
  const row = [...tools, ...tools]
  return (
    <div className="marquee" aria-label="Eingesetzte Tools und Plattformen">
      <ul className="marquee__track">
        {row.map((tool, i) => (
          <li key={`${tool}-${i}`} className="marquee__item" aria-hidden={i >= tools.length}>
            {tool}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProcessSection() {
  return (
    <section className="section section--paper" aria-labelledby="ablauf-title">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">Ablauf</p>
          <h2 className="section-title" id="ablauf-title">
            Vier Schritte, keine Überraschungen
          </h2>
          <p className="lead">
            Vom ersten Gespräch bis zum laufenden Betrieb weißt du jederzeit, woran wir
            sind und was als Nächstes passiert.
          </p>
        </Reveal>

        <ol className="steps">
          {processSteps.map((step, i) => (
            <Reveal as="li" key={step.step} index={i} className="step">
              <span className="step__num">{step.step}</span>
              <h3 className="step__title">{step.title}</h3>
              <p className="step__text">{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function TestimonialsSection() {
  return (
    <section className="section" aria-labelledby="stimmen-title">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">Kundenstimmen</p>
          <h2 className="section-title" id="stimmen-title">
            Was Kunden zurückmelden
          </h2>
        </Reveal>

        <ul className="quotes">
          {testimonials.map((item, i) => (
            <Reveal as="li" key={item.name} index={i} className="quote">
              <span className="quote__mark" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="quote__text">
                <p>{item.quote}</p>
              </blockquote>
              <figcaption className="quote__who">
                <span className="quote__avatar" aria-hidden="true">
                  {item.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </span>
                <span>
                  <span className="quote__name">{item.name}</span>
                  <br />
                  <span className="quote__role">{item.role}</span>
                </span>
              </figcaption>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function ComparisonSection() {
  // Each tone gets its own glyph so the meaning survives without colour.
  const toneIcon = { good: 'check', mid: 'clock', bad: 'minus' } as const

  return (
    <section className="section section--paper" aria-labelledby="vergleich-title">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">Einordnung</p>
          <h2 className="section-title" id="vergleich-title">
            Freelancer, Agentur oder eigene Stelle?
          </h2>
          <p className="lead">
            Alle drei Wege sind legitim. Der Vergleich zeigt, wo der jeweilige Vorteil
            wirklich liegt — auch da, wo er nicht bei mir liegt.
          </p>
        </Reveal>

        <Reveal className="table-scroll">
          <table className="compare">
            <caption className="visually-hidden">
              Vergleich von Youman, einer Agentur und einer Festanstellung anhand von
              sechs Kriterien
            </caption>
            <thead>
              <tr>
                <th scope="col">Kriterium</th>
                {comparison.columns.map((col, i) => (
                  <th key={col} scope="col" data-own={i === 0 ? 'true' : undefined}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, i) => (
                    <td key={`${row.label}-${i}`} data-own={i === 0 ? 'true' : undefined}>
                      <span className={`cell cell--${value.tone}`}>
                        <Icon name={toneIcon[value.tone]} size={16} />
                        {value.text}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  )
}

export function CtaBand({
  title = 'Lass uns über deinen Prozess sprechen.',
  text = `Beschreib mir kurz, was heute manuell läuft. Du bekommst innerhalb von ${site.responseTime} eine ehrliche Einschätzung — auch dann, wenn Automatisierung sich nicht lohnt.`,
}: {
  title?: string
  text?: string
}) {
  return (
    <section className="cta-band" aria-labelledby="cta-title">
      <div className="container cta-band__inner">
        <div>
          <h2 className="cta-band__title" id="cta-title">
            {title}
          </h2>
          <p className="cta-band__text" style={{ marginTop: 'var(--s-5)' }}>
            {text}
          </p>
        </div>
        <div className="cta-band__actions">
          <Link href="/kontakt" className="btn btn--invert">
            Projekt anfragen
            <Icon name="arrow" size={16} />
          </Link>
          <a href={`mailto:${site.email}`} className="btn btn--outline-invert">
            E-Mail schreiben
          </a>
        </div>
      </div>
    </section>
  )
}
