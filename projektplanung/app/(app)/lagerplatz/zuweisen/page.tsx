import type { Metadata } from 'next';
import { plentyConfigured } from '@/lib/plenty/client';
import Zuweisung from './Zuweisung';

export const metadata: Metadata = { title: 'Lagerplätze zuweisen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default function ZuweisenPage() {
  return <Zuweisung plentyReady={plentyConfigured()} />;
}
