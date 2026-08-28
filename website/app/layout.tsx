import type { Metadata, Viewport } from 'next'
import { Inter, Jost } from 'next/font/google'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { JsonLd, organizationJsonLd } from '@/lib/seo'
import { site } from '@/lib/site'
import './globals.css'
import './ui.css'

/* Self-hosted by next/font: no external request, no layout shift. */
const jost = Jost({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500'],
  display: 'swap',
  variable: '--font-jost',
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.fullName} — KI-Automationen, Chatbots & Websites`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.fullName,
  authors: [{ name: site.legalName, url: site.url }],
  creator: site.legalName,
  publisher: site.legalName,
  alternates: {
    canonical: site.url,
    languages: { 'de-DE': site.url },
  },
  keywords: [
    'KI-Automatisierung',
    'Prozessautomatisierung',
    'Make.com Freelancer',
    'n8n Entwickler',
    'KI-Chatbot entwickeln lassen',
    'Website erstellen lassen',
    'E-Commerce Automatisierung',
    'Shopify Schnittstelle',
    'PlentyONE Anbindung',
  ],
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: site.url,
    siteName: site.fullName,
    title: `${site.fullName} — KI-Automationen, Chatbots & Websites`,
    description: site.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.fullName} — KI-Automationen, Chatbots & Websites`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'technology',
  formatDetection: { telephone: true, email: true, address: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${jost.variable} ${inter.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Zum Inhalt springen
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <JsonLd data={organizationJsonLd()} />
      </body>
    </html>
  )
}
