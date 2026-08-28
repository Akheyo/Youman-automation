import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { CtaBand, TestimonialsSection } from '@/components/Sections'
import { referenzen } from '@/lib/referenzen'
import { JsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Referenzprojekte',
  description:
    'Umgesetzte Projekte im Detail: Marktplatz-Synchronisation, KI-Kundenservice mit Wissensbasis, Sprachnotiz zu Aufgabe und eine Unternehmenswebsite mit Anfragestrecke.',
  path: '/referenzprojekte',
  keywords: ['Referenzprojekte Automatisierung', 'Case Study KI', 'Projektbeispiele n8n'],
})

export default function ReferenzprojektePage() {
  return (
    <>
      <PageHead
        crumb="Referenzprojekte"
        eyebrow="Referenzprojekte"
        title="Was ich gebaut habe — und wie"
        lead="Vier Projekte mit Ausgangslage, Vorgehen und Ergebnis. Ohne aufgehübschte Kennzahlen: Was hier steht, beschreibt das System, nicht das Marketing."
      />

      <section className="section" aria-label="Projektübersicht">
        <div className="container">
          <ul className="grid-cards">
            {referenzen.map((r, i) => (
              <Reveal as="li" key={r.slug} index={i} className="case">
                <p className="case__kicker">{r.brancheLabel}</p>
                <h2 className="case__title">
                  <Link href={`/referenzprojekte/${r.slug}`} className="card__link">
                    {r.title}
                  </Link>
                </h2>
                <p className="case__text">{r.teaser}</p>
                <div className="tags">
                  {r.stack.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <span className="card__more">
                  Projekt ansehen
                  <Icon name="arrow" size={15} />
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <TestimonialsSection />
      <CtaBand
        title="Ähnliches Vorhaben?"
        text="Wenn ich etwas Vergleichbares schon gebaut habe, bekommen Sie die Einschätzung sofort — inklusive der Stellen, an denen es beim letzten Mal gehakt hat."
      />

      <JsonLd
        data={breadcrumbJsonLd([{ name: 'Referenzprojekte', path: '/referenzprojekte' }])}
      />
    </>
  )
}
