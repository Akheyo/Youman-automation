import type { Metadata, Viewport } from 'next'
import { Newsreader, Source_Sans_3 } from 'next/font/google'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { JsonLd, organizationJsonLd } from '@/lib/seo'
import { site } from '@/lib/site'
import './globals.css'
import './ui.css'

/* Selbst gehostet über next/font: keine externe Anfrage, kein Layout-Shift. */
/* Newsreader bringt eine optische Größenachse mit: große Überschriften
   bekommen feinere Striche, kleiner Text kräftigere. Das ist echter
   Satz statt bloßer Skalierung. */
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  axes: ['opsz'],
  /* Next.js kennt für Newsreader keine Metriken zur automatischen
     Anpassung der Ersatzschrift; deshalb wird sie hier ausdrücklich
     benannt und die Anpassung abgeschaltet, statt eine Warnung zu lassen. */
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: false,
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-sans',
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
  themeColor: '#0a0a0a',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${newsreader.variable} ${sourceSans.variable}`}>
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
