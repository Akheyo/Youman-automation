import type { Metadata } from 'next';
import PremiumHero from '@/components/landing/PremiumHero';
import {
  Announce,
  LandingNav,
  TrustStrip,
  BranchenGrid,
  TeamSection,
  HowItWorks,
  Benefits,
  PricingTeaser,
  Faq,
  FinalCta,
  LandingFooter,
} from '@/components/landing/Sections';
import styles from '@/components/landing/landing.module.css';

export const metadata: Metadata = {
  title: 'Youman Automation — dein KI-Vertriebsteam, das anruft & Termine bucht',
  description:
    'Felix findet Firmen, Anna analysiert, Paul schreibt den Pitch – und Lina ruft an, qualifiziert und bucht Termine direkt in deinen Kalender. Auf Deutsch, DSGVO-konform.',
};

export default function StartPage() {
  return (
    <div className={styles.page}>
      <Announce />
      <LandingNav />

      <PremiumHero
        eyebrow="Dein KI-Vertriebsteam"
        titleLead="Neue Kunden gewinnen –"
        titleHighlight="vollautomatisch"
        sub="Felix findet passende Firmen, Anna analysiert sie, Paul schreibt den Pitch – und Lina ruft an, qualifiziert und bucht den Termin direkt in deinen Kalender. Du gibst nur noch frei."
        bullets={['Leads finden, anschreiben & anrufen', 'Termine automatisch im Kalender', 'DSGVO-konform & auf Deutsch', 'Kostenlos starten – keine Karte nötig']}
        photo="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1100&q=80"
        photoAlt="Vertriebsteam im Gespräch"
        primary={{ href: '/signup', label: 'Kostenlos starten' }}
        secondary={{ href: '/pricing', label: 'Preise ansehen' }}
      />

      <TrustStrip />
      <BranchenGrid />
      <TeamSection />
      <HowItWorks />
      <Benefits />
      <PricingTeaser />
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
