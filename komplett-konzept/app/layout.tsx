import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Komplett Konzept — Automationen',
    template: '%s · Komplett Konzept',
  },
  description: 'Übersicht, Ausführungen, Fehler und Steuerung aller Automationen.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0e1420',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
