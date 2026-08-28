import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { ComparisonSection, CtaBand } from '@/components/Sections'
import { JsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo'
import { tools } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Über mich',
  description:
    'Youman — Entwickler aus Deutschland, spezialisiert auf KI-Automatisierung, LLM-Chatbots und moderne Websites. Direkte Zusammenarbeit ohne Agentur-Zwischenschicht.',
  path: '/ueber-mich',
})

const principles = [
  {
    title: 'Ein Ansprechpartner',
    text: 'Du sprichst vom ersten Gespräch bis zum Support mit derselben Person. Nichts geht auf dem Weg durch eine Kette verloren.',
  },
  {
    title: 'Ehrliche Einschätzung',
    text: 'Wenn sich Automatisierung für deinen Fall nicht rechnet, sage ich das — lieber ein Projekt weniger als eines, das niemandem hilft.',
  },
  {
    title: 'Verständliche Übergabe',
    text: 'Du bekommst dokumentiert, was gebaut wurde und wie es sich anpassen lässt. Kein Wissen, das nur in meinem Kopf existiert.',
  },
  {
    title: 'Erreichbar nach dem Launch',
    text: 'Fragen, kleine Anpassungen, Erweiterungen — direkt per E-Mail oder WhatsApp, ohne Ticket-System.',
  },
]

export default function UeberMichPage() {
  return (
    <>
      <PageHead
        crumb="Über mich"
        eyebrow="Über mich"
        title="Hey — ich bin Youman"
        lead="Entwickler aus Deutschland, spezialisiert auf KI-Automatisierung, intelligente Chatbots und performante Websites."
      />

      <section className="section">
        <div className="container">
          <div className="split">
            <Reveal>
              <h2 className="section-title" style={{ fontSize: 'var(--t-xl)' }}>
                Technik plus Geschäftsverständnis
              </h2>
              <div className="prose" style={{ marginTop: 'var(--s-5)' }}>
                <p>
                  Die meisten Automatisierungsprojekte scheitern nicht an der Technik,
                  sondern daran, dass niemand den Prozess dahinter sauber verstanden hat.
                  Deshalb beginnt bei mir jedes Projekt mit der Frage, was am Ende
                  wirklich anders sein soll — nicht mit der Frage, welches Tool zum
                  Einsatz kommt.
                </p>
                <p>
                  Was mich von einer Agentur unterscheidet: Du sprichst immer direkt mit
                  mir. Kein Account-Manager, keine Weitergabe an Subunternehmer, keine
                  Übersetzungsverluste zwischen dem, was du brauchst, und dem, was gebaut
                  wird.
                </p>
                <p>
                  Und was mich von einer eigenen Stelle unterscheidet: Du zahlst für das
                  Projekt, nicht für ein Jahr. Wenn nichts zu tun ist, kostet es nichts.
                </p>
              </div>

              <p style={{ marginTop: 'var(--s-6)' }}>
                <Link href="/kontakt" className="link-arrow">
                  Projekt anfragen
                  <Icon name="arrow" size={16} />
                </Link>
              </p>
            </Reveal>

            <Reveal index={1}>
              <h2 className="footer__heading">Womit ich arbeite</h2>
              <div className="tags" style={{ marginTop: 'var(--s-5)' }}>
                {tools.map((tool) => (
                  <span className="tag" key={tool}>
                    {tool}
                  </span>
                ))}
              </div>

              <h2 className="footer__heading" style={{ marginTop: 'var(--s-8)' }}>
                Wie ich arbeite
              </h2>
              <ul className="contact-list">
                {principles.map((item) => (
                  <li className="contact-item" key={item.title}>
                    <Icon name="check" size={18} />
                    <div>
                      <p className="contact-item__value" style={{ marginTop: 0 }}>
                        {item.title}
                      </p>
                      <p
                        style={{
                          marginTop: 'var(--s-2)',
                          fontSize: 'var(--t-sm)',
                          color: 'var(--ink-3)',
                          lineHeight: 1.7,
                        }}
                      >
                        {item.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <ComparisonSection />
      <CtaBand />

      <JsonLd data={breadcrumbJsonLd([{ name: 'Über mich', path: '/ueber-mich' }])} />
    </>
  )
}
