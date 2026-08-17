// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Beide Werte kommen aus der Umgebung, damit derselbe Build sowohl unter
// https://akheyo.github.io/<repo>/ als auch unter einer eigenen Domain läuft.
// Siehe README.md -> "Deployment".
// `||` statt `??`: configure-pages liefert bei einer eigenen Domain einen
// leeren String, der hier zu "/" werden muss.
const SITE = process.env.SITE_URL || 'https://akheyo.github.io';
const BASE = process.env.SITE_BASE || '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    // Cast nötig: @tailwindcss/vite bündelt eigene Vite-Typen, die nicht
    // deckungsgleich mit denen von Astro sind. Zur Laufzeit unproblematisch.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
