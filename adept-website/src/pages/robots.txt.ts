import type { APIRoute } from 'astro';
import { indexierungErlaubt } from '../data/sichtbarkeit';

/**
 * robots.txt als Route statt als feste Datei, damit sie zum Schalter in
 * sichtbarkeit.ts passt.
 *
 * Bewusst kein "Disallow: /", solange die Seite gesperrt ist. Ein Disallow
 * verbietet nur das Abrufen, nicht die Aufnahme in den Index, und es hätte
 * hier die gegenteilige Wirkung: die Suchmaschine bekäme das noindex in den
 * Seiten nie zu sehen und könnte die Adresse trotzdem listen, nur eben ohne
 * Inhalt. Abrufen bleibt deshalb erlaubt, die Sperre steht in jeder Seite.
 */
export const GET: APIRoute = ({ site }) => {
  const basis = site?.href.replace(/\/$/, '') ?? '';

  const zeilen = indexierungErlaubt
    ? ['User-agent: *', 'Allow: /', '', `Sitemap: ${basis}/sitemap-index.xml`]
    : [
        '# Diese Website ist noch nicht zur Aufnahme in Suchmaschinen freigegeben.',
        '# Die Sperre steht als noindex in jeder einzelnen Seite. Das Abrufen',
        '# bleibt absichtlich erlaubt, weil eine Suchmaschine das noindex sonst',
        '# nie zu sehen bekaeme.',
        '',
        'User-agent: *',
        'Allow: /',
      ];

  return new Response(zeilen.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
