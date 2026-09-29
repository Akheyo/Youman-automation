import type { Metadata } from 'next';
import { plentyEingerichtet } from '@/lib/plenty/client';
import { marktplaatsEingerichtet } from '@/lib/marktplaats/client';
import { zaehleSpiegel } from '@/lib/marktplaats/spiegel';
import Marktplaats from './Marktplaats';

export const metadata: Metadata = { title: 'Marktplaats · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default async function MarktplaatsPage() {
  const [plentyReady, mpReady, bestand] = await Promise.all([
    plentyEingerichtet(),
    marktplaatsEingerichtet(),
    zaehleSpiegel(),
  ]);
  return <Marktplaats plentyReady={plentyReady} mpReady={mpReady} bestand={bestand} />;
}
