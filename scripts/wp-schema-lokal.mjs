/**
 * Setzt Service-Schema auf den Orts- und Leistungsseiten.
 *
 * Ohne eigenes Schema markiert Rank Math jede Seite als "Article" - eine
 * Leistungsseite eines Handwerksbetriebs ist aber kein Artikel. Service-Schema
 * mit "areaServed" sagt Suchmaschinen ausdruecklich, welche Leistung in welchem
 * Ort angeboten wird, und verknuepft sie mit dem Firmeneintrag der Startseite.
 *
 * Standard ist ein Trockenlauf; erst --anwenden schreibt.
 *
 * Aufruf:
 *   node scripts/wp-schema-lokal.mjs [--anwenden]
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

/** Die Firma aus dem Schema der Startseite - dorthin zeigt jede Leistung. */
const ANBIETER = { '@id': `${base}/#organization` };

/** Orte, in denen der Betrieb arbeitet. Reihenfolge = Slug-Reihenfolge. */
const ORTE = {
  borken: 'Borken',
  ahaus: 'Ahaus',
  bocholt: 'Bocholt',
  coesfeld: 'Coesfeld',
  dorsten: 'Dorsten',
  gescher: 'Gescher',
  heiden: 'Heiden',
  raesfeld: 'Raesfeld',
  reken: 'Reken',
  rhede: 'Rhede',
  stadtlohn: 'Stadtlohn',
  velen: 'Velen',
};

/** Leistungsseiten: eine Leistung, angeboten im gesamten Einzugsgebiet. */
const LEISTUNGEN = {
  photovoltaik: ['Photovoltaik-Installation', 'Planung, Montage und Inbetriebnahme von Photovoltaikanlagen für Privat, Gewerbe und Industrie.'],
  stromspeicher: ['Stromspeicher-Installation', 'Beratung, Auslegung und Nachrüstung von Batteriespeichern für bestehende und neue Photovoltaikanlagen.'],
  wallbox: ['Wallbox-Installation', 'Installation und Anmeldung von Wallboxen für das Laden von Elektrofahrzeugen mit eigenem Solarstrom.'],
  'gewerbe-photovoltaik': ['Gewerbliche Photovoltaik', 'Photovoltaikanlagen für Gewerbe- und Industriedächer inklusive Wirtschaftlichkeitsberechnung.'],
  mieterstrom: ['Mieterstrom', 'Planung und Umsetzung von Mieterstrommodellen für Mehrfamilienhäuser und Wohnanlagen.'],
  'service-wartung': ['Wartung und Service', 'Wartung, Prüfung und Störungsbehebung an bestehenden Photovoltaikanlagen und Speichern.'],
};

const alleOrte = Object.values(ORTE).map((o) => ({ '@type': 'City', name: o }));

/** Schema-Bausteine je Slug zusammenstellen. */
const plan = [];
for (const [slug, ort] of Object.entries(ORTE)) {
  plan.push({
    slug: `photovoltaik-${slug}`,
    schema: {
      '@type': 'Service',
      metadata: { title: 'Service', type: 'template', shortcode: `s-ab-${slug}`, isPrimary: '1' },
      name: `Photovoltaik ${ort}`,
      serviceType: 'Photovoltaik-Installation',
      description: `Planung, Montage und Inbetriebnahme von Photovoltaikanlagen, Stromspeichern und Wallboxen in ${ort}.`,
      areaServed: { '@type': 'City', name: ort },
      provider: ANBIETER,
    },
  });
}
for (const [slug, [typ, text]] of Object.entries(LEISTUNGEN)) {
  plan.push({
    slug,
    schema: {
      '@type': 'Service',
      metadata: { title: 'Service', type: 'template', shortcode: `s-ab-${slug}`, isPrimary: '1' },
      name: typ,
      serviceType: typ,
      description: text,
      areaServed: alleOrte,
      provider: ANBIETER,
    },
  });
}

async function api(pfad, opts = {}) {
  const res = await fetch(`${base}/wp-json${pfad}`, {
    ...opts,
    headers: { Authorization: auth, 'User-Agent': 'youman-wp-schema', ...(opts.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* kein JSON */
  }
  return { status: res.status, body };
}

const seiten = new Map();
for (let s = 1; s <= 5; s++) {
  const r = await api(`/wp/v2/pages?status=publish&per_page=100&page=${s}&_fields=id,slug`);
  if (r.status !== 200 || !Array.isArray(r.body) || !r.body.length) break;
  for (const p of r.body) seiten.set(p.slug, p.id);
  if (r.body.length < 100) break;
}

console.log(`\n${anwenden ? 'SCHREIBEN' : 'TROCKENLAUF (nichts wird geaendert)'} — ${base}\n${'='.repeat(70)}`);
const aufgaben = [];
for (const p of plan) {
  const id = seiten.get(p.slug);
  if (!id) {
    console.log(`  ⚠️  /${p.slug}/ nicht gefunden`);
    continue;
  }
  const gebiet = Array.isArray(p.schema.areaServed)
    ? `${p.schema.areaServed.length} Orte`
    : p.schema.areaServed.name;
  console.log(`  #${String(id).padStart(5)} /${p.slug.padEnd(26)} Service "${p.schema.serviceType}" — ${gebiet}`);
  aufgaben.push({ id, ...p });
}
console.log(`${'='.repeat(70)}\n${aufgaben.length} Seiten`);

if (!anwenden) {
  console.log('\nNichts geaendert. Zum Ausfuehren:  node scripts/wp-schema-lokal.mjs --anwenden\n');
  process.exit(0);
}

let ok = 0;
const fehler = [];
for (const a of aufgaben) {
  const r = await api('/rankmath/v1/updateMeta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ objectID: a.id, objectType: 'post', meta: { rank_math_schema_Service: a.schema } }),
  });
  if (r.status === 200) ok++;
  else fehler.push(`/${a.slug} -> ${r.status} ${r.body?.message ?? ''}`);
  process.stdout.write(`\r  ${ok + fehler.length}/${aufgaben.length}`);
}
process.stdout.write('\n');
console.log(`\n✅ ${ok} Seiten mit Service-Schema versehen.`);
if (fehler.length) for (const f of fehler) console.log(`  ⚠️  ${f}`);
