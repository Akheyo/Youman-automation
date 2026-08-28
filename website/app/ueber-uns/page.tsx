import Link from 'next/link'
import { Figure } from '@/components/Figure'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { ComparisonSection, CtaBand } from '@/components/Sections'
import { JsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo'
import { tools } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Über uns',
  description:
    'Youman ist auf Prozessautomatisierung, KI-Anwendungen und Software-Schnittstellen für den Mittelstand spezialisiert. Direkte Zusammenarbeit ohne Agentur-Zwischenschicht.',
  path: '/ueber-uns',
})

const prinzipien = [
  {
    title: 'Ein Ansprechpartner',
    text: 'Sie sprechen vom ersten Gespräch bis zum Support mit derselben Person. Nichts geht auf dem Weg durch eine Kette verloren.',
  },
  {
    title: 'Ehrliche Einschätzung',
    text: 'Wenn sich Automatisierung für Ihren Fall nicht rechnet, sagen wir das — lieber ein Projekt weniger als eines, das niemandem hilft.',
  },
  {
    title: 'Verständliche Übergabe',
    text: 'Sie bekommen dokumentiert, was gebaut wurde und wie es sich anpassen lässt. Kein Wissen, das nur in einem Kopf existiert.',
  },
  {
    title: 'Erreichbar nach dem Launch',
    text: 'Fragen, kleine Anpassungen, Erweiterungen — direkt per E-Mail oder Telefon, ohne Ticket-System.',
  },
]

export default function UeberUnsPage() {
  return (
    <>
      <PageHead
        crumb="Über uns"
        eyebrow="Über uns"
        title="Technik, die das Geschäft dahinter versteht"
        lead="Youman ist auf Prozessautomatisierung, KI-Anwendungen und Software-Schnittstellen für mittelständische Unternehmen spezialisiert."
      />

      <section className="section">
        <div className="container">
          <div className="split">
            <Reveal>
              <Figure bild="portrait" sizes="(min-width: 940px) 40vw, 100vw" />
            </Reveal>

            <Reveal index={1}>
              <h2 className="section-title" style={{ fontSize: 'var(--t-xl)' }}>
                Warum Projekte scheitern — und woran es selten liegt
              </h2>
              <div className="prose" style={{ marginTop: 'var(--s-5)' }}>
                <p>
                  Die meisten Automatisierungsvorhaben scheitern nicht an der Technik,
                  sondern daran, dass niemand den Prozess dahinter sauber verstanden hat.
                  Deshalb beginnt bei uns jedes Projekt mit der Frage, was am Ende
                  wirklich anders sein soll — nicht mit der Frage, welches Werkzeug zum
                  Einsatz kommt.
                </p>
                <p>
                  Was uns von einer Agentur unterscheidet: Sie sprechen immer direkt mit
                  der Person, die auch baut. Kein Account-Management, keine Weitergabe an
                  Subunternehmer, keine Übersetzungsverluste zwischen dem, was Sie
                  brauchen, und dem, was entsteht.
                </p>
                <p>
                  Was uns von einer eigenen Stelle unterscheidet: Sie zahlen für das
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
          </div>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="arbeitsweise-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Arbeitsweise</p>
            <h2 className="section-title" id="arbeitsweise-title">
              Vier Punkte, auf die Sie sich verlassen können
            </h2>
          </Reveal>

          <ul className="grid-cards">
            {prinzipien.map((item, i) => (
              <Reveal as="li" key={item.title} index={i} className="card">
                <h3 className="card__title">{item.title}</h3>
                <p className="card__text">{item.text}</p>
              </Reveal>
            ))}
          </ul>

          <Reveal style={{ marginTop: 'var(--s-7)' }}>
            <h3 className="footer__heading">Womit wir arbeiten</h3>
            <div className="tags">
              {tools.map((tool) => (
                <span className="tag" key={tool}>
                  {tool}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <div className="band">
        <Figure bild="arbeitsweise" sizes="100vw" />
      </div>

      <ComparisonSection />
      <CtaBand />

      <JsonLd data={breadcrumbJsonLd([{ name: 'Über uns', path: '/ueber-uns' }])} />
    </>
  )
}
