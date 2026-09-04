/**
 * Setzt Rank-Math-SEO-Felder (Meta-Beschreibung, Fokus-Keyword) fuer eine
 * feste Liste von Seiten. Die Aenderungen stehen ausdruecklich im Skript,
 * damit nachvollziehbar bleibt, was auf der Kundenseite passiert ist.
 *
 * Standard ist ein Trockenlauf; erst --anwenden schreibt.
 *
 * Zugangsdaten aus .env.local oder Env: WP_URL, WP_USER, WP_APP_PASSWORD
 *
 * Aufruf:
 *   node scripts/wp-seo-meta.mjs              # nur anzeigen
 *   node scripts/wp-seo-meta.mjs --anwenden
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
  console.error('❌ WP_URL, WP_USER und WP_APP_PASSWORD noetig. Siehe wordpress/VERBINDUNG.md');
  process.exit(1);
}
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

/**
 * Gekuerzte Meta-Beschreibungen. Google schneidet ab etwa 160 Zeichen ab;
 * die bisherigen Texte lagen darueber und wurden mitten im Satz gekappt.
 * Inhalt und Tonfall bleiben, nur die Laenge aendert sich.
 */
const BESCHREIBUNGEN = {
  kontakt:
    'Kostenlose Beratung zu Photovoltaik, Stromspeicher & Wallbox in Borken. Rufen Sie an unter 02861 / 9080137 oder schreiben Sie uns – wir melden uns schnell.',
  referenzen:
    'Photovoltaik-Projekte von A&B Solarenergy in Borken und dem Münsterland: Anlagen, Speicher & Wallboxen aus der Praxis. Jetzt Referenzen ansehen.',
  'ueber-uns':
    'Das Team von A&B Solarenergy: erfahrene Fachleute für Photovoltaik in Borken. Regionale Nähe, geprüfte Qualität, persönliche Beratung. Jetzt kennenlernen.',
  wallbox:
    'Wallbox-Installation vom Elektro-Fachbetrieb in Borken: sicher laden mit eigenem Solarstrom. Montage & Anmeldung beim Netzbetreiber inklusive. Jetzt anfragen.',
  stromspeicher:
    'Mehr Eigenverbrauch mit dem passenden Batteriespeicher zur PV-Anlage. Beratung, Auslegung & Nachrüstung in Borken und Umgebung. Jetzt beraten lassen.',
  photovoltaik:
    'Photovoltaikanlagen vom Fachbetrieb in Borken: individuelle Planung, hochwertige Module, Montage & Inbetriebnahme. Günstiger Solarstrom – jetzt anfragen.',
};

/**
 * Fokus-Keywords. Rank Math bewertet eine Seite nur, wenn eines gesetzt ist -
 * ohne bleibt der SEO-Score auf 0 und die Seite taucht in keiner Auswertung auf.
 * Funktions- und Rechtsseiten bekommen bewusst keines.
 */
const KEYWORDS = {
  faq: 'Photovoltaik FAQ',
  'gewerbe-photovoltaik': 'Gewerbe Photovoltaik',
  mieterstrom: 'Mieterstrom',
  'ratgeber-photovoltaik-kosten-2026': 'Photovoltaik Kosten',
  'service-wartung': 'Photovoltaik Wartung',
  ...Object.fromEntries(
    ['borken', 'ahaus', 'bocholt', 'coesfeld', 'dorsten', 'gescher', 'heiden', 'raesfeld', 'reken', 'rhede', 'stadtlohn', 'velen'].map(
      (ort) => [`photovoltaik-${ort}`, `Photovoltaik ${ort[0].toUpperCase()}${ort.slice(1)}`]
    )
  ),
};

/**
 * Bild fuer die Vorschau beim Teilen (WhatsApp, Facebook, LinkedIn).
 * Ohne og:image zeigen diese Dienste nur einen Textblock ohne Bild.
 * Gewaehlt: Drohnenaufnahme einer eigenen Gewerbedach-Anlage, 1600x900 -
 * ein echtes Projekt statt eines Katalogbilds.
 */
const SOCIAL_BILD = {
  id: 5542,
  url: 'https://ab-solarenergy.de/wp-content/uploads/2026/05/WhatsApp-Image-2026-05-13-at-14.32.43-6.jpeg',
};

/** Seiten, die das Vorschaubild bekommen. */
const SOCIAL_SEITEN = [
  'home-1', 'photovoltaik', 'stromspeicher', 'wallbox', 'gewerbe-photovoltaik',
  'mieterstrom', 'service-wartung', 'referenzen', 'ueber-uns', 'kontakt', 'faq',
  'ratgeber-photovoltaik-kosten-2026',
  ...['borken', 'ahaus', 'bocholt', 'coesfeld', 'dorsten', 'gescher', 'heiden',
      'raesfeld', 'reken', 'rhede', 'stadtlohn', 'velen'].map((o) => `photovoltaik-${o}`),
];

/**
 * Seiten, die aus dem Suchindex sollen. Sie werden nicht geloescht - sie sind
 * erreichbar und verlinkbar, tauchen aber nicht mehr in Suchergebnissen auf.
 *
 * Rechtstexte in englischer Sprache stehen hier, weil es sie auf Deutsch
 * gibt (/impressum/ und /datenschutzerklaerung/); die englischen sind Reste
 * des gekauften Themes. Geloescht werden sie bewusst nicht - bei Rechtstexten
 * entscheidet das der Betreiber, nicht ein Skript.
 */
const NOINDEX = {
  'privacy-policy-2': 'englischer Theme-Rest, deutsche Datenschutzerklaerung vorhanden',
  'terms-and-conditions': 'englischer Theme-Rest, nicht als AGB verknuepft',
  blog: 'leere Beitragsuebersicht, 0 veroeffentlichte Beitraege',
  wishlist: 'Funktionsseite ohne Suchwert',
  'yith-compare': 'Funktionsseite ohne Suchwert',
};

/**
 * Titel und Fokus-Keyword mussten zusammenpassen: Rank Math bewertet eine
 * Seite ab, wenn das Keyword nicht im SEO-Titel steht - und der Ortsname im
 * Titel ist bei regionaler Suche ein eigener Faktor. Wo der Titel gut war,
 * wurde stattdessen das Keyword angepasst (Bindestrich-Schreibweise).
 */
const TITEL = {
  referenzen: 'Photovoltaik Referenzen Borken & Münsterland | A&B',
  kontakt: 'Photovoltaik Beratung Borken – Kontakt | A&B Solarenergy',
  faq: 'Photovoltaik FAQ – Häufige Fragen | A&B Solarenergy',
};

/** Keywords, die an einen bereits guten Titel angeglichen werden. */
const KEYWORD_KORREKTUR = {
  'ueber-uns': 'Solar-Fachbetrieb Borken',
  referenzen: 'Photovoltaik Referenzen Borken',
  kontakt: 'Photovoltaik Beratung Borken',
};

async function api(pfad, opts = {}) {
  const res = await fetch(`${base}/wp-json${pfad}`, {
    ...opts,
    headers: { Authorization: auth, 'User-Agent': 'youman-wp-seo-meta', ...(opts.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* kein JSON */
  }
  return { status: res.status, body };
}

// Seiten-IDs zu den Slugs holen.
const seiten = new Map();
for (let s = 1; s <= 5; s++) {
  const r = await api(`/wp/v2/pages?status=publish&per_page=100&page=${s}&_fields=id,slug`);
  if (r.status !== 200 || !Array.isArray(r.body) || !r.body.length) break;
  for (const p of r.body) seiten.set(p.slug, p.id);
  if (r.body.length < 100) break;
}

const aufgaben = [];
for (const [slug, text] of Object.entries(BESCHREIBUNGEN)) {
  const id = seiten.get(slug);
  if (!id) {
    console.log(`  ⚠️  Seite /${slug}/ nicht gefunden`);
    continue;
  }
  aufgaben.push({ id, slug, feld: 'rank_math_description', wert: text });
}
for (const [slug, kw] of Object.entries(KEYWORDS)) {
  const id = seiten.get(slug);
  if (!id) {
    console.log(`  ⚠️  Seite /${slug}/ nicht gefunden`);
    continue;
  }
  aufgaben.push({ id, slug, feld: 'rank_math_focus_keyword', wert: kw });
}

for (const slug of SOCIAL_SEITEN) {
  const id = seiten.get(slug);
  if (!id) {
    console.log(`  ⚠️  Seite /${slug}/ nicht gefunden`);
    continue;
  }
  aufgaben.push({ id, slug, feld: 'rank_math_facebook_image', wert: SOCIAL_BILD.url });
  aufgaben.push({ id, slug, feld: 'rank_math_facebook_image_id', wert: SOCIAL_BILD.id });
  aufgaben.push({ id, slug, feld: 'rank_math_twitter_use_facebook', wert: 'on' });
}

for (const [slug, titel] of Object.entries(TITEL)) {
  const id = seiten.get(slug);
  if (!id) continue;
  aufgaben.push({ id, slug, feld: 'rank_math_title', wert: titel });
}
for (const [slug, kw] of Object.entries(KEYWORD_KORREKTUR)) {
  const id = seiten.get(slug);
  if (!id) continue;
  aufgaben.push({ id, slug, feld: 'rank_math_focus_keyword', wert: kw });
}

for (const [slug, grund] of Object.entries(NOINDEX)) {
  const id = seiten.get(slug);
  if (!id) {
    console.log(`  ⚠️  Seite /${slug}/ nicht gefunden`);
    continue;
  }
  aufgaben.push({ id, slug, feld: 'rank_math_robots', wert: ['noindex', 'follow'], grund });
}

console.log(`\n${anwenden ? 'SCHREIBEN' : 'TROCKENLAUF (nichts wird geaendert)'} — ${base}\n${'='.repeat(72)}`);
for (const a of aufgaben) {
  const kurz = a.feld.replace('rank_math_', '');
  const laenge = a.feld.endsWith('description') ? ` (${String(a.wert).length} Zeichen)` : '';
  console.log(`  #${String(a.id).padStart(5)} /${a.slug.padEnd(34)} ${kurz.padEnd(26)}${laenge}`);
  if (a.feld.endsWith('description')) console.log(`         ${a.wert}`);
  if (a.grund) console.log(`         ${a.grund}`);
}
console.log(`${'='.repeat(72)}\n${aufgaben.length} Aenderungen`);

if (!anwenden) {
  console.log('\nNichts geaendert. Zum Ausfuehren:  node scripts/wp-seo-meta.mjs --anwenden\n');
  process.exit(0);
}

let ok = 0;
const fehler = [];
for (const a of aufgaben) {
  const r = await api('/rankmath/v1/updateMeta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ objectID: a.id, objectType: 'post', meta: { [a.feld]: a.wert } }),
  });
  if (r.status === 200) ok++;
  else fehler.push(`/${a.slug} ${a.feld} -> ${r.status} ${r.body?.message ?? ''}`);
  process.stdout.write(`\r  ${ok + fehler.length}/${aufgaben.length}`);
}
process.stdout.write('\n');
console.log(`\n✅ ${ok} Felder gesetzt.`);
if (fehler.length) {
  console.log(`⚠️  ${fehler.length} fehlgeschlagen:`);
  for (const f of fehler) console.log(`  ${f}`);
}
