import type { Metadata } from 'next'
import type { Branche } from './branchen'
import { branchen } from './branchen'
import type { Referenz } from './referenzen'
import { services, site } from './site'

/**
 * Every page builds its metadata through this helper so canonical URLs,
 * OpenGraph and Twitter cards can never drift apart.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
}: {
  title: string
  description: string
  path: string
  keywords?: string[]
}): Metadata {
  const url = path === '/' ? site.url : `${site.url}${path}`

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: site.locale,
      url,
      siteName: site.fullName,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

const ORG_ID = `${site.url}/#organization`
const SITE_ID = `${site.url}/#website`

/** Organisation + website — emitted once, in the root layout. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        '@id': ORG_ID,
        name: site.fullName,
        legalName: site.legalName,
        url: site.url,
        email: site.email,
        telephone: site.phone,
        description: site.description,
        slogan: site.tagline,
        priceRange: '€€',
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'DE',
        },
        areaServed: site.areaServed.map((name) => ({ '@type': 'Country', name })),
        knowsAbout: [
          'KI-Automatisierung',
          'Prozessautomatisierung',
          'Make.com',
          'n8n',
          'LLM-Chatbots',
          'Retrieval Augmented Generation',
          'Next.js',
          'E-Commerce-Integration',
          'Shopify',
          'PlentyONE',
        ],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Leistungen',
          itemListElement: [
            ...services.map((service) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: service.title,
                description: service.teaser,
                url: `${site.url}/leistungen#${service.slug}`,
              },
            })),
            ...branchen.map((branche) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: `Automatisierung für ${branche.title}`,
                description: branche.teaser,
                url: `${site.url}/branchen/${branche.slug}`,
              },
            })),
          ],
        },
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        url: site.url,
        name: site.fullName,
        inLanguage: 'de-DE',
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

/** Breadcrumbs for every page below the root. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: 'Startseite', path: '/' },
      ...trail,
    ].map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.path === '/' ? site.url : `${site.url}${item.path}`,
    })),
  }
}

/** FAQ rich result — nur zulässig, wo die Fragen auf der Seite sichtbar sind. */
export function faqPageJsonLd(items: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}

/** Eine Branchenseite ist ein Service-Angebot für ein Marktsegment. */
export function brancheServiceJsonLd(branche: Branche) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Prozessautomatisierung für ${branche.title}`,
    description: branche.metaDescription,
    serviceType: 'Prozessautomatisierung',
    provider: { '@id': ORG_ID },
    areaServed: site.areaServed.map((name) => ({ '@type': 'Country', name })),
    url: `${site.url}/branchen/${branche.slug}`,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `Anwendungsfälle ${branche.title}`,
      itemListElement: branche.loesungen.map((l) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: l.title, description: l.text },
      })),
    },
  }
}

/** Referenzprojekte als Fallstudie. */
export function caseStudyJsonLd(referenz: Referenz) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: referenz.title,
    description: referenz.metaDescription,
    about: referenz.brancheLabel,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    inLanguage: 'de-DE',
    url: `${site.url}/referenzprojekte/${referenz.slug}`,
    mainEntityOfPage: `${site.url}/referenzprojekte/${referenz.slug}`,
  }
}

export function serviceJsonLd(slug: string) {
  const service = services.find((s) => s.slug === slug)
  if (!service) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title,
    description: service.teaser,
    serviceType: service.title,
    provider: { '@id': ORG_ID },
    areaServed: site.areaServed.map((name) => ({ '@type': 'Country', name })),
    url: `${site.url}/leistungen#${service.slug}`,
  }
}

/** Renders a JSON-LD block. Content is ours, never user input. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
