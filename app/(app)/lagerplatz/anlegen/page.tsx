import type { Metadata } from 'next';
import { plentyConfigured } from '@/lib/plenty/client';
import Anlegen from './Anlegen';

export const metadata: Metadata = { title: 'Lagerorte anlegen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default function AnlegenPage() {
  return <Anlegen plentyReady={plentyConfigured()} />;
}
