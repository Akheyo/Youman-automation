import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { CtaBand, TestimonialsSection } from '@/components/Sections'
import { JsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo'
import { projects } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Referenzen',
  description:
    'Ausgewählte Projekte: Voice-to-Task-Automation mit Make.com und Claude, Marktplatz-Synchronisation über n8n und PlentyONE, KI-Kundenservice mit RAG und eine Website mit Next.js.',
  path: '/referenzen',
})

export default function ReferenzenPage() {
  return (
    <>
      <PageHead
        crumb="Referenzen"
        eyebrow="Referenzen"
        title="Projekte, die im Alltag laufen"
        lead="Vier Beispiele aus der Praxis. Details zu Auftraggebern nenne ich auf Anfrage, sofern die jeweilige Zustimmung vorliegt."
      />

      <section className="section" aria-label="Projektübersicht">
        <div className="container">
          <ul className="work">
            {projects.map((project, i) => (
              <Reveal as="li" key={project.title} index={i} className="work__item">
                <p className="work__kicker">{project.kicker}</p>
                <h2 className="work__title">{project.title}</h2>
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
        </div>
      </section>

      <TestimonialsSection />
      <CtaBand
        title="Ähnliches Vorhaben?"
        text="Erzähl mir davon. Wenn ich etwas Vergleichbares schon gebaut habe, bekommst du die Einschätzung sofort."
      />

      <JsonLd data={breadcrumbJsonLd([{ name: 'Referenzen', path: '/referenzen' }])} />
    </>
  )
}
