/**
 * Prueft alle internen Links einer WordPress-Seite auf Erreichbarkeit.
 *
 * Holt die veroeffentlichten Inhalte ueber die REST-API (nicht ueber die
 * Sitemap - die kann veraltet sein), laedt jede Seite und sammelt alle Links.
 * Danach wird jedes Linkziel einmal geprueft und rueckgemeldet, von welcher
 * Seite aus es verlinkt ist.
 *
 * Zugangsdaten aus .env.local oder Env: WP_URL, WP_USER, WP_APP_PASSWORD
 * Ohne Zugangsdaten wird nur die oeffentliche Sitemap benutzt.
 *
 * Aufruf:
 *   node scripts/wp-linkcheck.mjs [--extern]
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

const auchExtern = process.argv.includes('--extern');
const base = (process.env.WP_URL || '').replace(/\/+$/, '');
const user = process.env.WP_USER;
const pass = (process.env.WP_APP_PASSWORD || '').replace(/\s+/g, '');
if (!base) {
  console.error('❌ WP_URL fehlt.');
  process.exit(1);
}
const auth = user && pass ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') : null;
const UA = 'Mozilla/5.0 (compatible; youman-linkcheck/1.0)';
const host = new URL(base).host;

/** Alle veroeffentlichten Inhalte eines Typs holen (mit Seitenblaetterung). */
async function inhalte(typ) {
  const raus = [];
  for (let seite = 1; seite <= 20; seite++) {
    const res = await fetch(`${base}/wp-json/wp/v2/${typ}?status=publish&per_page=100&page=${seite}&_fields=id,link,title`, {
      headers: { 'User-Agent': UA, ...(auth ? { Authorization: auth } : {}) },
    });
    if (res.status !== 200) break;
    const teil = await res.json();
    if (!Array.isArray(teil) || !teil.length) break;
    raus.push(...teil);
    if (teil.length < 100) break;
  }
  return raus;
}

console.log(`Linkpruefung ${base}\n${'='.repeat(60)}`);

const seiten = [];
for (const typ of ['pages', 'posts', 'product', 'cases']) {
  const teil = await inhalte(typ);
  if (teil.length) console.log(`  ${typ}: ${teil.length} veroeffentlicht`);
  seiten.push(...teil);
}
if (!seiten.length) {
  console.error('❌ Keine veroeffentlichten Inhalte gefunden (Zugangsdaten gesetzt?).');
  process.exit(1);
}

// Jede Seite laden und Links einsammeln. Ziel -> Menge der Fundorte.
const ziele = new Map();
let geladen = 0;
for (let i = 0; i < seiten.length; i += 5) {
  await Promise.all(
    seiten.slice(i, i + 5).map(async (s) => {
      let html = '';
      try {
        html = await (await fetch(s.link, { headers: { 'User-Agent': UA } })).text();
      } catch {
        return;
      }
      geladen++;
      for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
        let roh = m[1].trim();
        if (/^(#|mailto:|tel:|javascript:|data:)/i.test(roh) || !roh) continue;
        let url;
        try {
          url = new URL(roh, s.link);
        } catch {
          continue;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
        const intern = url.host === host;
        if (!intern && !auchExtern) continue;
        url.hash = '';
        const key = url.toString();
        if (!ziele.has(key)) ziele.set(key, { intern, quellen: new Set() });
        ziele.get(key).quellen.add(new URL(s.link).pathname);
      }
    })
  );
  process.stdout.write(`\r  Seiten geladen: ${geladen}/${seiten.length}`);
}
process.stdout.write(`\n  Verschiedene Linkziele: ${ziele.size}\n\n`);

// Jedes Ziel einmal pruefen.
const eintraege = [...ziele.entries()];
const kaputt = [];
let geprueft = 0;
for (let i = 0; i < eintraege.length; i += 8) {
  await Promise.all(
    eintraege.slice(i, i + 8).map(async ([url, info]) => {
      let status = 0;
      try {
        // Erst HEAD (spart Last), bei Ablehnung GET nachschieben.
        let r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow' });
        if (r.status === 405 || r.status === 501) {
          r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        }
        status = r.status;
      } catch (e) {
        status = 0;
        info.fehler = String(e.message || e).slice(0, 60);
      }
      geprueft++;
      if (status === 0 || status >= 400) kaputt.push({ url, status, ...info });
    })
  );
  process.stdout.write(`\r  geprueft: ${geprueft}/${eintraege.length}`);
}
process.stdout.write('\n\n');

const intern = kaputt.filter((k) => k.intern).sort((a, b) => b.quellen.size - a.quellen.size);
const extern = kaputt.filter((k) => !k.intern).sort((a, b) => b.quellen.size - a.quellen.size);

const zeigen = (titel, liste) => {
  console.log(`${'='.repeat(60)}\n${titel}: ${liste.length}\n`);
  for (const k of liste) {
    console.log(`  [${k.status || k.fehler}] ${k.url}`);
    console.log(`        verlinkt von: ${[...k.quellen].slice(0, 6).join(', ')}${k.quellen.size > 6 ? ` (+${k.quellen.size - 6})` : ''}`);
  }
  if (!liste.length) console.log('  keine\n');
  else console.log('');
};

zeigen('Kaputte interne Links', intern);
if (auchExtern) zeigen('Kaputte externe Links', extern);
console.log(`Geprueft: ${eintraege.length} Ziele auf ${geladen} Seiten.`);
