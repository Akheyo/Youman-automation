import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { JsonLd, organizationJsonLd } from '@/lib/seo'
import { site } from '@/lib/site'
import './globals.css'
import './ui.css'

/* Selbst gehostet über next/font: keine externe Anfrage, kein Layout-Shift. */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.fullName} — Prozesse automatisieren mit KI und Software`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.fullName,
  authors: [{ name: site.legalName, url: site.url }],
  creator: site.legalName,
  publisher: site.legalName,
  alternates: { canonical: site.url, languages: { 'de-DE': site.url } },
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: site.url,
    siteName: site.fullName,
    title: `${site.fullName} — Prozesse automatisieren mit KI und Software`,
    description: site.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.fullName} — Prozesse automatisieren mit KI und Software`,
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
  themeColor: '#0f172a',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${plexSans.variable} ${plexMono.variable}`}>
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
