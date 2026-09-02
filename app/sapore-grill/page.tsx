import type { Metadata } from 'next';
import { BUSINESS } from '@/lib/sapore/menu';
import styles from '@/components/sapore/sapore.module.css';
import OrderSection from '@/components/sapore/OrderSection';
import {
  Contact,
  FinalCta,
  Footer,
  Header,
  Hero,
  Hours,
  Specials,
  Steps,
  TrustStrip,
} from '@/components/sapore/Sections';

export const metadata: Metadata = {
  title: 'Sapore Grill Borken — Steakdöner, Pizza & Imbiss | Liefern & Abholen',
  description:
    'Sapore Grill in Borken: Steakdöner vom Jungbullen, Gemüse Kebap, knusprige Pizza, frische Salate und deftige Imbiss-Teller. Täglich 11–22 Uhr. Online bestellen — liefern oder abholen.',
  keywords: ['Döner Borken', 'Pizza Borken', 'Sapore Grill', 'Lieferservice Borken', 'Steakdöner'],
  openGraph: {
    title: 'Sapore Grill Borken — Ihr neuer Genuss-Hotspot',
    description:
      'Steakdöner vom Jungbullen, Gemüse Kebap, Pizza, Salate und Imbiss-Teller. Täglich 11–22 Uhr. Liefern oder abholen.',
    type: 'website',
    locale: 'de_DE',
  },
};

/** Strukturierte Daten, damit Google Adresse, Zeiten und Telefon direkt anzeigt. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: BUSINESS.name,
  description: 'Döner, Pizza, Imbiss und Salate in Borken — frisch zubereitet, zum Abholen oder Liefern.',
  servesCuisine: ['Türkisch', 'Döner', 'Pizza', 'Imbiss'],
  priceRange: '€',
  telephone: `+49 2861 4303`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.street,
    postalCode: BUSINESS.zip,
    addressLocality: BUSINESS.city,
    addressCountry: 'DE',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '11:00',
      closes: '22:00',
    },
  ],
  sameAs: [BUSINESS.instagramUrl],
};

export default function SaporeGrillPage() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        // Feste, im Code definierte Daten — kein Nutzereingabe-Inhalt.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Specials />
        <OrderSection />
        <Steps />
        <Hours />
        <Contact />
        <FinalCta />
      </main>
      <Footer />
      <div className={styles.mobileBarSpacer} aria-hidden="true" />
    </div>
  );
}
