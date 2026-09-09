import type { Metadata } from 'next';
import { plentyEingerichtet } from '@/lib/plenty/client';
import Suche from './Suche';

export const metadata: Metadata = { title: 'Artikel suchen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default async function SuchePage() {
  return <Suche plentyReady={await plentyEingerichtet()} />;
}
