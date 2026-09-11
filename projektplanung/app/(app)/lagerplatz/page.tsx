import type { Metadata } from 'next';
import { plentyEingerichtet } from '@/lib/plenty/client';
import LagerplatzScan from './LagerplatzScan';

export const metadata: Metadata = { title: 'Lagerplätze · Komplett Konzept Projektplanung' };
export const dynamic = 'force-dynamic';

export default async function LagerplatzPage() {
  return <LagerplatzScan plentyReady={await plentyEingerichtet()} />;
}
