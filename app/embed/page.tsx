/**
 * /embed — iframe-friendly variant.
 *
 * SSR-off because PVConfigurator is browser-only (Zustand + Cesium).
 */

import dynamic from 'next/dynamic';
import EmbedResizer from './EmbedResizer';

const PVConfigurator = dynamic(() => import('@/components/PVConfigurator'), {
  ssr: false,
});

export const metadata = {
  title: 'PV-Konfigurator',
  robots: { index: false, follow: false },
};

export default function EmbedPage() {
  return (
    <>
      <EmbedResizer />
      <PVConfigurator source="iframe@ab-solarenergy.de" />
    </>
  );
}
