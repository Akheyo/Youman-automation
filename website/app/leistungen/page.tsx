import Link from 'next/link'
import { Figure } from '@/components/Figure'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { CtaBand, FaqSection } from '@/components/Sections'
import {
  JsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  pageMetadata,
  serviceJsonLd,
} from '@/lib/seo'
import { faq, services } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Leistungen',
  description:
    'KI-Automationen mit Make.com und n8n, LLM-Chatbots mit RAG, Websites mit Next.js und E-Commerce-Integrationen für Shopify, PlentyONE, eBay und Amazon.',
  path: '/leistungen',
  keywords: [
    'KI-Automation Freelancer',
    'Make.com Entwickler',
    'n8n Workflow',
    'Chatbot mit RAG',
    'Next.js Website',
    'PlentyONE Schnittstelle',
  ],
})

export default function LeistungenPage() {
  return (
    <>
      <PageHead
        crumb="Leistungen"
        eyebrow="Leistungen"
        title="Was wir bauen — und was Sie davon haben"
        lead="Vier Bereiche, die sich in der Praxis ständig überschneiden. Meistens beginnt ein Projekt in einem davon und wächst in die anderen hinein."
      />

      <div className="section">
        <div className="container">
          {services.map((service, i) => (
            <Reveal key={service.slug} index={i} className="feature" id={service.slug}>
              <div>
                <p className="eyebrow">{service.index}</p>
                <h2 className="feature__title" style={{ marginTop: 'var(--s-4)' }}>
                  {service.title}
                </h2>
                <p className="feature__text">{service.body}</p>

                <ul className="checklist" style={{ marginTop: 'var(--s-5)' }}>
                  {service.outcomes.map((outcome) => (
                    <li key={outcome}>
                      <Icon name="check" size={16} />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>

                <div className="tags">
                  {service.stack.map((item) => (
                    <span className="tag" key={item}>
                      {item}
                    </span>
                  ))}
                </div>

                <p style={{ marginTop: 'var(--s-6)' }}>
                  <Link href="/kontakt" className="link-arrow">
                    Dazu anfragen
                    <Icon name="arrow" size={16} />
                  </Link>
                </p>
              </div>

              <div className="feature__media">
                <Figure bild={service.bild} sizes="(min-width: 900px) 50vw, 100vw" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <FaqSection items={faq} title="Häufige Fragen zur Zusammenarbeit" />
      <CtaBand
        title="Unsicher, welcher Bereich passt?"
        text="Schreiben Sie uns, was heute aufhält. Wir sortieren das Problem und sagen Ihnen, welcher Weg der kürzeste ist."
      />

      <JsonLd data={breadcrumbJsonLd([{ name: 'Leistungen', path: '/leistungen' }])} />
      <JsonLd data={faqPageJsonLd(faq)} />
      {services.map((service) => {
        const data = serviceJsonLd(service.slug)
        return data ? <JsonLd key={service.slug} data={data} /> : null
      })}
    </>
  )
}
