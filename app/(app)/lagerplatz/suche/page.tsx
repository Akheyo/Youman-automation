import type { Metadata } from 'next';
import { plentyConfigured } from '@/lib/plenty/client';
import Suche from './Suche';

export const metadata: Metadata = { title: 'Artikel suchen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default function SuchePage() {
  return <Suche plentyReady={plentyConfigured()} />;
}
