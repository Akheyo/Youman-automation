import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'A&B Solarenergy — PV-Konfigurator',
  description:
    'Photovoltaik-Konfigurator für NRW — in 5 Sekunden zur optimalen Solaranlage. Mit echten Dachformen aus dem NRW-Solarkataster.',
  authors: [{ name: 'A&B Solarenergy', url: 'https://www.ab-solarenergy.de' }],
  openGraph: {
    title: 'A&B Solarenergy — PV-Konfigurator',
    description:
      'Adresse eingeben → Solaranlage konfigurieren → Angebot erhalten. Kostenlos, unverbindlich.',
    type: 'website',
    locale: 'de_DE',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D73FC',
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
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap"
        />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
      </head>
      <body>
        {/*
          Cesium is loaded as a same-origin script from /cesium (copied from
          node_modules at install time). beforeInteractive ensures window.Cesium
          is ready before the configurator hydrates.
        */}
        <Script
          src="/cesium/Cesium.js"
          strategy="beforeInteractive"
          id="cesium-runtime"
        />
        <Script id="cesium-base-url" strategy="beforeInteractive">
          {"window.CESIUM_BASE_URL = '/cesium';"}
        </Script>
        {children}
      </body>
    </html>
  );
}
