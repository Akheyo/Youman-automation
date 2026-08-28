import Link from 'next/link'
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
        title="Was ich baue — und was du davon hast"
        lead="Vier Bereiche, die sich in der Praxis ständig überschneiden. Meistens beginnt ein Projekt in einem davon und wächst in die anderen hinein."
      />

      <div className="section">
        <div className="container">
          <div className="services" style={{ borderTop: 0 }}>
            {services.map((service, i) => (
              <Reveal key={service.slug} index={i} className="service" id={service.slug}>
                <span className="service__index">{service.index}</span>

                <div className="service__head">
                  <h2 className="service__title">
                    <Icon name={service.icon} size={22} />
                    <span style={{ display: 'block', marginTop: 'var(--s-3)' }}>
                      {service.title}
                    </span>
                  </h2>
                  <p className="service__teaser" style={{ marginTop: 'var(--s-4)' }}>
                    {service.body}
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
                  <h3
                    className="footer__heading"
                    style={{ marginBottom: 'var(--s-4)' }}
                  >
                    Ergebnis
                  </h3>
                  <ul className="service__list">
                    {service.outcomes.map((outcome) => (
                      <li key={outcome}>
                        <Icon name="check" size={16} />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                  <p style={{ marginTop: 'var(--s-6)' }}>
                    <Link href="/kontakt" className="link-arrow">
                      Dazu anfragen
                      <Icon name="arrow" size={16} />
                    </Link>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <FaqSection items={faq} title="Häufige Fragen zur Zusammenarbeit" />
      <CtaBand
        title="Unsicher, welcher Bereich passt?"
        text="Schreib mir, was heute nervt. Ich sortiere das Problem und sage dir, welcher Weg der kürzeste ist."
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
