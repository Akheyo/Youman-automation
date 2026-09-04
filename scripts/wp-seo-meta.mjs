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

console.log(`\n${anwenden ? 'SCHREIBEN' : 'TROCKENLAUF (nichts wird geaendert)'} — ${base}\n${'='.repeat(72)}`);
for (const a of aufgaben) {
  const kurz = a.feld.replace('rank_math_', '');
  const laenge = a.feld.endsWith('description') ? ` (${a.wert.length} Zeichen)` : '';
  console.log(`  #${String(a.id).padStart(5)} /${a.slug.padEnd(34)} ${kurz.padEnd(14)}${laenge}`);
  if (a.feld.endsWith('description')) console.log(`         ${a.wert}`);
  else console.log(`         "${a.wert}"`);
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
