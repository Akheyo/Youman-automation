/**
 * Liest die Sitemap einer WordPress-Seite, holt jede URL und prueft sie auf die
 * Dinge, die eine Seite unsichtbar machen: fehlende oder doppelte Titel,
 * noindex, kaputte Canonicals, duenne Texte, uebrig gebliebene Theme-Demo-
 * Inhalte und Seiten, die sich nur im Ortsnamen unterscheiden.
 *
 * Braucht keine Zugangsdaten - prueft die Seite so, wie Google sie sieht.
 *
 * Aufruf:
 *   node scripts/wp-seo-audit.mjs [https://example.de] [--out bericht.md]
 */

const argv = process.argv.slice(2);
const basis = (argv.find((a) => a.startsWith('http')) || process.env.WP_URL || '').replace(/\/+$/, '');
const outIdx = argv.indexOf('--out');
const outDatei = outIdx >= 0 ? argv[outIdx + 1] : null;

if (!basis) {
  console.error('❌ Keine URL. Aufruf: node scripts/wp-seo-audit.mjs https://example.de [--out bericht.md]');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (compatible; youman-seo-audit/1.0)';

// Muster fuer Seiten, die aus einem gekauften Theme stammen und nie
// aufgeraeumt wurden. Solche Seiten gehoeren nicht in den Google-Index.
const DEMO_MUSTER = [
  /^\/(sample-page|hello-world)/,
  /^\/(home-2|home-3|home-onepage|about|our-services|our-gallery|our-contacts|services-details|product-details|products-gallery|cases-2)\//,
  /^\/(progress-bars|counters|charts|alerts|buttons|tabs|accordions|testimonials|pricing-tables|team)\//,
  /^\/(cart-2|checkout-2|my-account-2|yith-compare|wishlist)\//,
  /^\/cases\//, // Referenz-CPT des Themes, im Original mit Fantasie-Projekten befuellt
  /^\/\d{4}\/\d{2}\/\d{2}\//, // Datums-Beitraege des Demo-Blogs
];
// Seiten, die technisch noetig sind, aber nichts im Index verloren haben.
const FUNKTIONS_MUSTER = [/^\/(cart|checkout|my-account)\//];

const holen = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  return { status: res.status, url: res.url, text: await res.text() };
};

const treffer = (html, re) => {
  const m = re.exec(html);
  return m ? m[1].trim() : null;
};

const entity = (s) =>
  s ? s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ') : s;

/** Sichtbaren Text extrahieren: Skripte/Styles raus, Tags raus. */
function textVon(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Wortmenge fuer den Aehnlichkeitsvergleich (Zahlen und Kurzwoerter raus). */
function wortmenge(text) {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-zäöüß]{4,}/g)
      ?.slice(0, 4000) ?? []
  );
}

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let schnitt = 0;
  for (const w of a) if (b.has(w)) schnitt++;
  return schnitt / (a.size + b.size - schnitt);
};

// ---------------------------------------------------------------- Sitemap ---
async function sitemapUrls(start) {
  const gesehen = new Set();
  const urls = [];
  const queue = [start];
  while (queue.length) {
    const sm = queue.shift();
    if (gesehen.has(sm)) continue;
    gesehen.add(sm);
    let xml;
    try {
      xml = (await holen(sm)).text;
    } catch {
      continue;
    }
    const istIndex = /<sitemapindex/i.test(xml);
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      if (istIndex) queue.push(m[1]);
      else urls.push(m[1]);
    }
  }
  return [...new Set(urls)];
}

// -------------------------------------------------------------------- Lauf ---
console.log(`Sitemap lesen: ${basis}/sitemap_index.xml`);
let urls = await sitemapUrls(`${basis}/sitemap_index.xml`);
if (!urls.length) urls = await sitemapUrls(`${basis}/wp-sitemap.xml`);
if (!urls.length) {
  console.error('❌ Keine Sitemap gefunden (weder sitemap_index.xml noch wp-sitemap.xml).');
  process.exit(1);
}
console.log(`${urls.length} URLs gefunden. Wird geprueft ...\n`);

const seiten = [];
const parallel = 5;
for (let i = 0; i < urls.length; i += parallel) {
  const gruppe = urls.slice(i, i + parallel);
  const teil = await Promise.all(
    gruppe.map(async (url) => {
      try {
        const r = await holen(url);
        const html = r.text;
        const text = textVon(html);
        return {
          url,
          pfad: new URL(url).pathname,
          status: r.status,
          weitergeleitet: r.url.replace(/\/+$/, '') !== url.replace(/\/+$/, ''),
          ziel: r.url,
          titel: entity(treffer(html, /<title[^>]*>([\s\S]*?)<\/title>/i)),
          beschreibung: entity(treffer(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)),
          robots: treffer(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i),
          canonical: treffer(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
          h1: entity(treffer(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, '') ?? null),
          woerter: text.split(' ').filter(Boolean).length,
          bytes: html.length,
          menge: wortmenge(text),
        };
      } catch (e) {
        return { url, pfad: new URL(url).pathname, status: 0, fehler: String(e.message || e), menge: new Set() };
      }
    })
  );
  seiten.push(...teil);
  process.stdout.write(`\r  ${seiten.length}/${urls.length}`);
}
process.stdout.write('\n\n');

// ------------------------------------------------------------- Auswertung ---
const befunde = [];
const add = (schwere, thema, text, betroffen = []) => befunde.push({ schwere, thema, text, betroffen });

const demo = seiten.filter((s) => DEMO_MUSTER.some((re) => re.test(s.pfad)));
const funktion = seiten.filter((s) => FUNKTIONS_MUSTER.some((re) => re.test(s.pfad)));
const echt = seiten.filter((s) => !demo.includes(s) && !funktion.includes(s));

if (demo.length) {
  add('hoch', 'Theme-Demo-Inhalte im Index',
    `${demo.length} von ${seiten.length} URLs sind uebrig gebliebene Demo-Seiten/-Beitraege des gekauften Themes. ` +
    `Das sind ${Math.round((demo.length / seiten.length) * 100)} % der Sitemap. Google bewertet damit die halbe Seite als leeren Platzhalter.`,
    demo.map((s) => s.pfad));
}
if (funktion.length) {
  add('mittel', 'Shop-Funktionsseiten in der Sitemap',
    `Warenkorb/Kasse/Konto gehoeren nicht in den Index (kein Suchwert, oft Duplicate Content).`,
    funktion.map((s) => s.pfad));
}

const noindex = seiten.filter((s) => s.robots && /noindex/i.test(s.robots));
if (noindex.length) add('hoch', 'Seiten auf noindex', `${noindex.length} URLs sind vom Index ausgeschlossen, stehen aber in der Sitemap.`, noindex.map((s) => s.pfad));

const kaputt = seiten.filter((s) => s.status >= 400 || s.status === 0);
if (kaputt.length) add('hoch', 'Nicht erreichbare URLs', `${kaputt.length} URLs in der Sitemap antworten mit Fehler.`, kaputt.map((s) => `${s.pfad} (${s.status || s.fehler})`));

const umgeleitet = seiten.filter((s) => s.weitergeleitet);
if (umgeleitet.length) add('niedrig', 'Weiterleitungen in der Sitemap', `${umgeleitet.length} URLs leiten weiter. In die Sitemap gehoert das Ziel.`, umgeleitet.map((s) => `${s.pfad} → ${s.ziel}`));

const ohneTitel = seiten.filter((s) => s.status === 200 && !s.titel);
if (ohneTitel.length) add('hoch', 'Ohne Seitentitel', `${ohneTitel.length} URLs haben keinen <title>.`, ohneTitel.map((s) => s.pfad));

const ohneBeschreibung = echt.filter((s) => s.status === 200 && !s.beschreibung);
if (ohneBeschreibung.length) add('mittel', 'Ohne Meta-Beschreibung', `${ohneBeschreibung.length} echte Seiten haben keine Meta-Beschreibung — Google textet den Snippet dann selbst.`, ohneBeschreibung.map((s) => s.pfad));

const titelGruppen = new Map();
for (const s of seiten.filter((x) => x.titel)) {
  const k = s.titel.toLowerCase();
  titelGruppen.set(k, [...(titelGruppen.get(k) ?? []), s.pfad]);
}
const doppelTitel = [...titelGruppen.values()].filter((g) => g.length > 1);
if (doppelTitel.length) add('mittel', 'Doppelte Seitentitel', `${doppelTitel.length} Titel kommen mehrfach vor.`, doppelTitel.map((g) => g.join('  ==  ')));

const duenn = echt.filter((s) => s.status === 200 && s.woerter < 300);
if (duenn.length) add('mittel', 'Duenne Seiten', `${duenn.length} echte Seiten haben unter 300 Woerter sichtbaren Text.`, duenn.map((s) => `${s.pfad} (${s.woerter} Woerter)`));

// Fast-Duplikate: Seiten, deren Wortschatz sich zu >90 % deckt.
const dubletten = [];
const kandidaten = echt.filter((s) => s.status === 200 && s.menge.size > 50);
for (let i = 0; i < kandidaten.length; i++) {
  for (let j = i + 1; j < kandidaten.length; j++) {
    const q = jaccard(kandidaten[i].menge, kandidaten[j].menge);
    if (q >= 0.9) dubletten.push({ a: kandidaten[i].pfad, b: kandidaten[j].pfad, q });
  }
}
if (dubletten.length) {
  const gruppen = new Map();
  for (const d of dubletten) {
    gruppen.set(d.a, [...(gruppen.get(d.a) ?? []), d.b]);
  }
  add('hoch', 'Nahezu identische Seiten (Doorway-Muster)',
    `${dubletten.length} Seitenpaare stimmen zu ueber 90 % im Wortschatz ueberein — typischerweise Ortsseiten, bei denen nur der Stadtname getauscht wurde. ` +
    `Google waehlt daraus hoechstens eine Seite aus und ignoriert den Rest.`,
    [...gruppen.entries()].map(([a, bs]) => `${a}  ≈  ${bs.join(', ')}`));
}

// ------------------------------------------------------------- Ausgabe ------
const rang = { hoch: 0, mittel: 1, niedrig: 2 };
befunde.sort((x, y) => rang[x.schwere] - rang[y.schwere]);

const zeilen = [];
zeilen.push(`# SEO-Befund ${basis.replace(/^https?:\/\//, '')}`, '');
zeilen.push(`Stand: ${new Date().toISOString().slice(0, 10)} · ${seiten.length} URLs aus der Sitemap geprueft.`, '');
zeilen.push(`| | Anzahl |`, `|---|---|`);
zeilen.push(`| URLs gesamt | ${seiten.length} |`);
zeilen.push(`| davon echte Inhaltsseiten | ${echt.length} |`);
zeilen.push(`| davon Theme-Demo-Reste | ${demo.length} |`);
zeilen.push(`| davon Shop-Funktionsseiten | ${funktion.length} |`, '');

for (const b of befunde) {
  zeilen.push(`## [${b.schwere.toUpperCase()}] ${b.thema}`, '', b.text, '');
  if (b.betroffen.length) {
    zeilen.push('<details><summary>Betroffen</summary>', '', '```');
    zeilen.push(...b.betroffen.slice(0, 200));
    if (b.betroffen.length > 200) zeilen.push(`... und ${b.betroffen.length - 200} weitere`);
    zeilen.push('```', '', '</details>', '');
  }
}
if (!befunde.length) zeilen.push('Keine Auffaelligkeiten gefunden.', '');

const bericht = zeilen.join('\n');
if (outDatei) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outDatei, bericht);
  console.log(`Bericht geschrieben: ${outDatei}`);
}
console.log(bericht);
