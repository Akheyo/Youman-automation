import type { Metadata } from 'next';
import { plentyEingerichtet } from '@/lib/plenty/client';
import Zuweisung from './Zuweisung';

export const metadata: Metadata = { title: 'Lagerplätze zuweisen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default async function ZuweisenPage() {
  return <Zuweisung plentyReady={await plentyEingerichtet()} />;
}
