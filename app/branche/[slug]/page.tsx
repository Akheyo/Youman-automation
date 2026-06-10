import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PremiumHero from '@/components/landing/PremiumHero';
import {
  LandingNav,
  TrustStrip,
  HowItWorks,
  Benefits,
  PricingTeaser,
  Faq,
  FinalCta,
  LandingFooter,
} from '@/components/landing/Sections';
import { INDUSTRIES, getIndustry } from '@/lib/landing/industries';
import styles from '@/components/landing/landing.module.css';

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ slug: i.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const i = getIndustry(params.slug);
  if (!i) return { title: 'Branche · Youman Automation' };
  return { title: i.metaTitle, description: i.metaDesc };
}

export default function BranchePage({ params }: { params: { slug: string } }) {
  const i = getIndustry(params.slug);
  if (!i) notFound();

  return (
    <div className={styles.page}>
      <LandingNav />

      <PremiumHero
        back={{ href: '/#branchen', label: 'Branchen' }}
        titleLead={`${i.eyebrow} ${i.title}`}
        titleHighlight={i.highlight}
        sub={i.sub}
        bullets={i.bullets}
        photo={i.photo}
        photoAlt={`KI-Telefonassistent ${i.label}`}
        photoNeed={i.photoNeed}
        primary={{ href: '/signup', label: 'Demo buchen' }}
        secondary={{ href: '/signup', label: 'Testanruf machen' }}
      />

      <TrustStrip />
      <HowItWorks />
      <Benefits />
      <PricingTeaser />
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
