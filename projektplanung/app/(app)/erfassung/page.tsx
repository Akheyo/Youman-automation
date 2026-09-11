import type { Metadata } from 'next';
import Erfassung from './Erfassung';

export const metadata: Metadata = { title: 'Erfassung · Komplett Konzept Projektplanung' };
export const dynamic = 'force-dynamic';

export default function ErfassungPage() {
  return <Erfassung />;
}
