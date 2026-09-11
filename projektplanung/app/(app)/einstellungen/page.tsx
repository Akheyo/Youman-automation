import type { Metadata } from 'next';
import Einstellungen from './Einstellungen';

export const metadata: Metadata = { title: 'Einstellungen · Komplett Konzept' };
export const dynamic = 'force-dynamic';

export default function EinstellungenPage() {
  return <Einstellungen />;
}
