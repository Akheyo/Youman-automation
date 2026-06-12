import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from './pwa-register';

export const metadata: Metadata = {
  title: 'Youman Automation — dein KI-Vertriebsteam, das anruft & Termine bucht',
  description:
    'Youman Automation ist dein KI-Vertriebsteam: Firmen finden, analysieren, anschreiben – und per Telefon zum Termin bringen. Auf Deutsch, DSGVO-konform.',
  authors: [{ name: 'Youman Automation' }],
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Youman' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  openGraph: {
    title: 'Youman Automation — dein KI-Vertriebsteam',
    description:
      'Firmen finden, anschreiben und per KI-Telefonie zum Termin bringen. Auf Deutsch, DSGVO-konform.',
    type: 'website',
    locale: 'de_DE',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7c3aed',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/no-css-tags */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
