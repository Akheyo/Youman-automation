import type { Metadata } from 'next';
import KitchenBoard from './KitchenBoard';

/** Interne Ansicht — gehoert nicht in den Suchindex. */
export const metadata: Metadata = {
  title: 'Küche — Sapore Grill',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default function KuechePage() {
  return <KitchenBoard />;
}
