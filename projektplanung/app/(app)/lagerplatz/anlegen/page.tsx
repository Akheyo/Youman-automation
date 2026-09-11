import type { Metadata } from 'next';
import { plentyEingerichtet } from '@/lib/plenty/client';
import Anlegen from './Anlegen';
import Laufweg from './Laufweg';

export const metadata: Metadata = { title: 'Lagerorte anlegen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default async function AnlegenPage() {
  const plentyReady = await plentyEingerichtet();
  return (
    <>
      <Anlegen plentyReady={plentyReady} />
      {plentyReady && <Laufweg />}
    </>
  );
}
