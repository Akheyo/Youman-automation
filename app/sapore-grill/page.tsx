import type { Metadata } from 'next';
import { BUSINESS, DELIVERY, MENU, MENU_IS_PLACEHOLDER } from '@/lib/sapore/menu';
import styles from '@/components/sapore/sapore.module.css';
import OrderSection from '@/components/sapore/OrderSection';
import {
  Contact,
  FinalCta,
  Footer,
  Gallery,
  Header,
  Hero,
  Hours,
  Quote,
  Specials,
  Steps,
  TrustStrip,
} from '@/components/sapore/Sections';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.youman-automation.com').replace(
  /\/$/,
  '',
);
const PATH = '/sapore-grill';

const TITLE = 'Sapore Grill Borken — Steakdöner, Pizza & Imbiss | Liefern und Abholen';
const DESCRIPTION =
  'Sapore Grill an der Johann-Walling-Straße 10 in Borken: Steakdöner vom Jungbullen, Gemüse Kebap, knusprige Pizza, frische Salate und Imbiss-Teller. Täglich 11–22 Uhr geöffnet. Online bestellen — liefern lassen oder abholen.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    'Döner Borken',
    'Steakdöner Borken',
    'Pizza Borken',
    'Lieferservice Borken',
    'Imbiss Borken',
    'Sapore Grill',
    'Essen bestellen Borken',
    'Gemüse Kebap',
  ],
  category: 'Restaurant',
  // Ueberschreibt die Youman-Vorgabe aus dem Wurzel-Layout fuer diese Route.
  appleWebApp: { title: BUSINESS.name },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    title: 'Sapore Grill Borken — Steakdöner, Pizza & Imbiss',
    description:
      'Steakdöner vom Jungbullen, Gemüse Kebap, Pizza, Salate und Imbiss-Teller. Täglich 11–22 Uhr. Liefern lassen oder abholen.',
    url: `${SITE}${PATH}`,
    siteName: BUSINESS.name,
    type: 'website',
    locale: 'de_DE',
    images: [
      {
        url: '/sapore/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Steakdöner und Gemüse Kebap von Sapore Grill in Borken',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sapore Grill Borken — Steakdöner, Pizza & Imbiss',
    description: 'Täglich 11–22 Uhr. Online bestellen: liefern lassen oder abholen.',
    images: ['/sapore/og.jpg'],
  },
};

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Strukturierte Daten, damit Suchmaschinen Adresse, Zeiten, Telefon und die
 * Bestellmoeglichkeit direkt anzeigen koennen.
 *
 * Die Speisekarte wird nur ausgeliefert, wenn sie echt ist — Platzhalterpreise
 * in den strukturierten Daten waeren gegenueber Gaesten und Google irrefuehrend.
 */
function buildJsonLd() {
  const restaurant: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${SITE}${PATH}#restaurant`,
    name: BUSINESS.name,
    description: DESCRIPTION,
    url: `${SITE}${PATH}`,
    telephone: '+49 2861 4303',
    servesCuisine: ['Türkisch', 'Döner', 'Pizza', 'Imbiss'],
    priceRange: '€',
    currenciesAccepted: 'EUR',
    image: `${SITE}/sapore/og.jpg`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      postalCode: BUSINESS.zip,
      addressLocality: BUSINESS.city,
      addressRegion: 'Nordrhein-Westfalen',
      addressCountry: 'DE',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: WEEKDAYS,
        opens: `${BUSINESS.opensAt}:00`,
        closes: `${BUSINESS.closesAt}:00`,
      },
    ],
    hasDeliveryMethod: [
      { '@type': 'DeliveryMethod', name: 'Lieferung' },
      { '@type': 'DeliveryMethod', name: 'Abholung' },
    ],
    areaServed: DELIVERY.zips.map((zip) => ({
      '@type': 'PostalCodeRangeSpecification',
      postalCodeBegin: zip,
      postalCodeEnd: zip,
    })),
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE}${PATH}#speisekarte`,
        inLanguage: 'de-DE',
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      deliveryMethod: ['http://purl.org/goodrelations/v1#DeliveryModeOwnFleet'],
    },
    sameAs: [BUSINESS.instagramUrl],
  };

  if (!MENU_IS_PLACEHOLDER) {
    restaurant.hasMenu = {
      '@type': 'Menu',
      name: `Speisekarte ${BUSINESS.name}`,
      hasMenuSection: MENU.map((category) => ({
        '@type': 'MenuSection',
        name: category.name,
        description: category.note,
        hasMenuItem: category.items.map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          description: item.description,
          offers: { '@type': 'Offer', price: item.price.toFixed(2), priceCurrency: 'EUR' },
          suitableForDiet: item.tags?.includes('vegetarisch')
            ? 'https://schema.org/VegetarianDiet'
            : undefined,
        })),
      })),
    };
  }

  return [
    restaurant,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: SITE },
        { '@type': 'ListItem', position: 2, name: BUSINESS.name, item: `${SITE}${PATH}` },
      ],
    },
  ];
}

export default function SaporeGrillPage() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        // Feste, im Code definierte Daten — kein Inhalt aus Nutzereingaben.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Specials />
        <Quote />
        <OrderSection />
        <Gallery />
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
