import type { MetadataRoute } from 'next';

/**
 * Macht die App vom Startbildschirm aus startbar — ohne App Store, ohne
 * Installation, ohne Freigabeverfahren. Eine Änderung ist beim nächsten
 * Öffnen bei allen da.
 *
 * "start_url" zeigt bewusst auf die Erfassung: Wer das Icon am Handy antippt,
 * will fotografieren, nicht navigieren.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Komplett Konzept · Erfassung',
    short_name: 'Erfassung',
    description: 'Artikel am Regal fotografieren und sofort anlegen.',
    start_url: '/erfassung',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#122a63',
    lang: 'de',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
