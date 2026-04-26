/**
 * /embed — iframe-friendly variant.
 *
 * Strips the outer footer, removes the back-link to /privacy (the host site
 * has its own), and reports its scrollHeight via postMessage so the host can
 * resize the iframe seamlessly.
 */

import PVConfigurator from '@/components/PVConfigurator';
import EmbedResizer from './EmbedResizer';

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
