/**
 * Findet uebrig gebliebene Demo-Inhalte des gekauften Themes und legt sie in
 * den WordPress-Papierkorb. Zeigt standardmaessig nur an, was passieren wuerde
 * ("Trockenlauf") - erst --anwenden fasst die Seite wirklich an.
 *
 * Der Papierkorb ist kein endgueltiges Loeschen: WordPress haelt die Inhalte
 * dort vor und sie lassen sich per Klick zurueckholen.
 *
 * Zugangsdaten aus .env.local oder Env: WP_URL, WP_USER, WP_APP_PASSWORD
 *
 * Aufruf:
 *   node scripts/wp-demo-aufraeumen.mjs              # nur anzeigen
 *   node scripts/wp-demo-aufraeumen.mjs --anwenden   # in den Papierkorb legen
 */

import { readFileSync } from 'node:fs';

try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* keine .env.local */
}

const anwenden = process.argv.includes('--anwenden');
const base = (process.env.WP_URL || '').replace(/\/+$/, '');
const user = process.env.WP_USER;
const pass = (process.env.WP_APP_PASSWORD || '').replace(/\s+/g, '');

if (!base || !user || !pass) {
  console.error('❌ WP_URL, WP_USER und WP_APP_PASSWORD muessen gesetzt sein. Siehe wordpress/VERBINDUNG.md');
  process.exit(1);
}
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

/**
 * Inhaltstypen, die geprueft werden, mit den Slugs der Demo-Inhalte.
 * Bewusst als ausdrueckliche Liste statt als Muster: bei einer Aktion, die
 * Inhalte anfasst, soll nachvollziehbar sein, was genau getroffen wird.
 */
const DEMO = {
  pages: [
    // Baustein-Demoseiten des Themes (Shortcode-Schaukasten)
    'progress-bars', 'counters', 'charts', 'alerts', 'buttons', 'tabs',
    'accordions', 'testimonials', 'pricing-tables', 'team',
    // Zweit- und Drittfassungen der Startseite und Unterseiten
    'home-2', 'home-3', 'home-onepage', 'cases-2', 'about', 'our-services',
    'our-gallery', 'our-contacts', 'services-details', 'product-details',
    'products-gallery', 'sample-page',
    // Doppelte Shop-Seiten. WooCommerce zeigt auf die Seiten 14/15/16, diese
    // hier sind Karteileichen des Themes.
    'cart-2', 'checkout-2', 'my-account-2',
  ],
  posts: [
    'hello-world',
    'wind-farms-now-more-affordable', 'wind-farms-now-more-affordable-2-2',
    'modern-and-quality-solar-panels', 'modern-and-quality-solar-panels-2',
    'the-power-of-solar-energy-in-the-future', 'solar-energy-what-you-need-to-know',
    'how-you-can-earn-with-solar-energy', 'ferc-takes-a-firm-stand-in-pge',
    'surviving-sustainably-on-solar-2', 'clean-energy-without-co2',
    'clean-energy-leadership', 'renewable-energy-for-business',
  ],
  cases: [
    'solar-factory-in-ny', 'solar-field-in-los-angeles', 'renewable-energy-station',
    'canthigaster-rostrata-spikefish', 'slickhead-grunion-lake-trout',
    'streamer-fish-california-halibut-pacific',
  ],
  product: [
    'sun-power-light-device-2020-z141', 'sun-power-light-device-n12',
    'duomax-m-plus-deg13', 'duomax-m-plus-deg12-3', 'duomax-m-plus-deg12-3-2',
    'duomax-m-plus-deg22', 'duomax-m-plus-deg12', 'duomax-m-plus-deg12-2',
    'duomax-m-plus-deg12-2-2',
  ],
};

/**
 * Seiten, die zwar Demo-Inhalt sind, aber von einem Plugin als Funktionsseite
 * eingetragen sein koennen. Werden nur aufgelistet, nicht angefasst - sonst
 * wirft das Plugin hinterher Fehlermeldungen im Backend.
 */
const VORSICHT = {
  'yith-compare': 'YITH Vergleichsliste traegt diese Seite in ihren Einstellungen ein',
  wishlist: 'YITH Wunschliste traegt diese Seite in ihren Einstellungen ein',
};

async function api(pfad, opts = {}) {
  const res = await fetch(`${base}/wp-json${pfad}`, {
    ...opts,
    headers: { Authorization: auth, 'User-Agent': 'youman-wp-aufraeumen', ...(opts.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* kein JSON */
  }
  return { status: res.status, body };
}

const entity = (t) =>
  String(t ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8211;/g, '–');

console.log(`\n${anwenden ? 'AUFRAEUMEN' : 'TROCKENLAUF (nichts wird geaendert)'} — ${base}\n${'='.repeat(64)}`);

const gefunden = [];
const fehlt = [];

for (const [typ, slugs] of Object.entries(DEMO)) {
  for (const slug of slugs) {
    const r = await api(`/wp/v2/${typ}?slug=${encodeURIComponent(slug)}&status=any&context=edit`);
    const eintrag = Array.isArray(r.body) ? r.body[0] : null;
    if (!eintrag) {
      fehlt.push(`${typ}/${slug}`);
      continue;
    }
    gefunden.push({
      typ,
      id: eintrag.id,
      slug,
      titel: entity(eintrag.title?.rendered || eintrag.title?.raw || slug),
      status: eintrag.status,
      link: eintrag.link,
    });
  }
}

const aktiv = gefunden.filter((e) => e.status !== 'trash');
const schonWeg = gefunden.filter((e) => e.status === 'trash');

for (const typ of Object.keys(DEMO)) {
  const teil = aktiv.filter((e) => e.typ === typ);
  if (!teil.length) continue;
  console.log(`\n${typ} (${teil.length}):`);
  for (const e of teil) console.log(`  #${String(e.id).padStart(6)}  ${e.slug.padEnd(42)} ${e.titel.slice(0, 60)}`);
}

if (schonWeg.length) console.log(`\nBereits im Papierkorb: ${schonWeg.length}`);
if (fehlt.length) console.log(`Nicht gefunden (schon geloescht oder anderer Slug): ${fehlt.length}\n  ${fehlt.join('\n  ')}`);

console.log(`\nVon Hand pruefen (nicht angefasst):`);
for (const [slug, grund] of Object.entries(VORSICHT)) console.log(`  ${slug.padEnd(20)} ${grund}`);

console.log(`\n${'='.repeat(64)}\nZu verschieben: ${aktiv.length} Inhalte`);

if (!anwenden) {
  console.log('\nNichts geaendert. Zum Ausfuehren:  node scripts/wp-demo-aufraeumen.mjs --anwenden');
  console.log('Vorher ein Backup der Seite ziehen.\n');
  process.exit(0);
}

let ok = 0;
const schiefgegangen = [];
for (const e of aktiv) {
  // Ohne force=true landet der Inhalt im Papierkorb statt endgueltig geloescht
  // zu werden. Produkte kennen den Papierkorb ebenfalls.
  const r = await api(`/wp/v2/${e.typ}/${e.id}`, { method: 'DELETE' });
  if (r.status === 200) {
    ok++;
    process.stdout.write(`\r  ${ok}/${aktiv.length} verschoben`);
  } else {
    schiefgegangen.push(`${e.typ}/${e.slug} (#${e.id}) → ${r.status} ${r.body?.message ?? ''}`);
  }
}
process.stdout.write('\n');

console.log(`\n✅ ${ok} Inhalte im Papierkorb.`);
if (schiefgegangen.length) {
  console.log(`\n⚠️  ${schiefgegangen.length} nicht verschoben:`);
  for (const z of schiefgegangen) console.log(`  ${z}`);
}
console.log('\nNaechster Schritt: Sitemap in der Search Console neu einreichen,');
console.log('damit Google die verschwundenen URLs zeitnah mitbekommt.\n');
