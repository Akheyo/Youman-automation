import type { Metadata } from 'next';
import { plentyEingerichtet } from '@/lib/plenty/client';
import Anlegen from './Anlegen';

export const metadata: Metadata = { title: 'Lagerorte anlegen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default async function AnlegenPage() {
  return <Anlegen plentyReady={await plentyEingerichtet()} />;
}
