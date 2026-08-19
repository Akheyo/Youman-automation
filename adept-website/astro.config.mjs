// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Beide Werte kommen aus der Umgebung, damit derselbe Build sowohl unter
// https://akheyo.github.io/<repo>/ als auch unter www.adeptandpartners.de läuft.
// Siehe README.md -> "Deployment".
// `||` statt `??`: configure-pages liefert bei einer eigenen Domain einen
// leeren String, der hier zu "/" werden muss.
//
// Solange "Enforce HTTPS" in den Pages-Einstellungen nicht aktiv ist, meldet
// configure-pages die Adresse als http. Dieser Wert landet in den kanonischen
// Links, in OpenGraph und in der Sitemap - Suchmaschinen bekaemen damit die
// unverschluesselte Variante als offizielle Adresse. Das Schema wird deshalb
// erzwungen; GitHub Pages liefert die eigene Domain ohnehin ueber https aus.
const SITE = (process.env.SITE_URL || 'https://www.adeptandpartners.de').replace(
  /^http:\/\//,
  'https://',
);
const BASE = process.env.SITE_BASE || '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    sitemap({
      /*
       * Seiten, die auf noindex stehen, gehoeren nicht in die Sitemap. Beides
       * zugleich ist ein Widerspruch: die Sitemap bittet um Indexierung, das
       * robots-Meta verbietet sie. Die Google Search Console meldet das als
       * "Uebermittelte URL als noindex gekennzeichnet".
       *
       * Impressum und Datenschutz stehen auf noindex, solange dort
       * Platzhalter statt Rechtstexten steht - eine Seite mit dem Hinweis
       * "Impressum fehlt noch" hat in der Suche nichts verloren. Sobald die
       * Texte da sind, koennen beide hier und in der jeweiligen Seite
       * freigegeben werden.
       */
      filter: (seite) => !/\/(impressum|datenschutz)\/?$/.test(seite),
    }),
  ],
  vite: {
    // Cast nötig: @tailwindcss/vite bündelt eigene Vite-Typen, die nicht
    // deckungsgleich mit denen von Astro sind. Zur Laufzeit unproblematisch.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
