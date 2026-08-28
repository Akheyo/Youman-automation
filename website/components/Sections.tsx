import Link from 'next/link'
import { Accordion } from './Accordion'
import { Icon } from './Icon'
import { Reveal } from './Reveal'
import { comparison, site, testimonials } from '@/lib/site'

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

        <ul className="grid-cards grid-cards--3">
          {testimonials.map((item, i) => (
            <Reveal as="li" key={item.name} index={i} className="card">
              <blockquote className="card__text">
                <p>{item.quote}</p>
              </blockquote>
              <figcaption style={{ marginTop: 'auto', paddingTop: 'var(--s-4)' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--t-base)' }}>
                  {item.name}
                </span>
                <br />
                <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-5)' }}>
                  {item.role}
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
  // Jede Ausprägung bekommt ein eigenes Zeichen, damit die Aussage nicht
  // allein an der Farbe hängt.
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
            liegt — auch da, wo er nicht bei mir liegt.
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

export function FaqSection({
  items,
  title = 'Häufige Fragen',
  eyebrow = 'FAQ',
  narrow = true,
}: {
  items: readonly { q: string; a: string }[]
  title?: string
  eyebrow?: string
  narrow?: boolean
}) {
  return (
    <section className="section" aria-labelledby="faq-title">
      <div className={narrow ? 'container container--narrow' : 'container'}>
        <Reveal className="section-head">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="section-title" id="faq-title">
            {title}
          </h2>
        </Reveal>
        <Reveal>
          <Accordion items={items} />
        </Reveal>
      </div>
    </section>
  )
}

export function CtaBand({
  title = 'Konkreten Fall besprechen',
  text = 'Wir sehen uns Ihren Prozess an und sagen Ihnen, was sich davon automatisieren lässt.',
}: {
  title?: string
  text?: string
}) {
  return (
    <section className="cta-band" aria-labelledby="cta-title">
      <div className="container cta-band__inner">
        <div>
          <span className="cta-band__strich" aria-hidden="true" />
          <h2 className="cta-band__title" id="cta-title">
            {title}
          </h2>
          <p className="cta-band__text">{text}</p>
        </div>
        <div className="cta-band__actions">
          <Link href="/kontakt" className="btn btn--invert">
            Kontakt aufnehmen
          </Link>
        </div>
      </div>
    </section>
  )
}
