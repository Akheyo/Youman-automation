#!/usr/bin/env node
/**
 * SEO- und Auszeichnungsprüfung gegen das gebaute HTML.
 *
 * Bewusst ohne Browser und ohne Abhängigkeiten: die allermeisten Fehler
 * stecken im ausgelieferten Markup und lassen sich dort direkt lesen. Das
 * hält die Prüfung schnell und macht sie unabhängig davon, ob gerade ein
 * Vorschauserver läuft.
 *
 *   node .claude/skills/seo/scripts/statisch.mjs [dist-Verzeichnis]
 *
 * Rückgabewert 0, wenn nichts gefunden wurde, sonst 1. Damit lässt sie sich
 * in einen Ablauf einhängen, der bei Befunden abbricht.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

const WURZEL = resolve(process.argv[2] ?? 'youman-website/dist');

/* ------------------------------------------------------------------ Regeln */

const REGELN = {
  titelMax: 60,          // Google schneidet in der Anzeige etwa hier ab
  titelMin: 10,
  beschreibungMin: 70,   // darunter wertet Google sie oft als zu dünn
  beschreibungMax: 165,
  /**
   * Projektregel: keine Gedankenstriche im sichtbaren Text. Sie waren in
   * den gelieferten Texten unerwünscht und schleichen sich beim Schreiben
   * sonst immer wieder ein.
   */
  keineGedankenstriche: true,
};

/* ------------------------------------------------------------- Hilfsmittel */

const dateien = (verzeichnis) => {
  const gefunden = [];
  const gehen = (pfad) => {
    for (const eintrag of readdirSync(pfad)) {
      const voll = join(pfad, eintrag);
      if (statSync(voll).isDirectory()) gehen(voll);
      else if (eintrag.endsWith('.html')) gefunden.push(voll);
    }
  };
  gehen(verzeichnis);
  return gefunden.sort();
};

const ohneSkripte = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

/**
 * HTML-Entitaeten aufloesen, bevor gezaehlt wird.
 *
 * Ohne das zaehlt "&amp;" als fuenf Zeichen statt als eines, und ein Titel
 * mit einem kaufmaennischen Und wirkt vier Zeichen laenger, als er ist. Der
 * erste Lauf dieser Pruefung ist genau darueber gestolpert.
 */
const NAMEN = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü',
  szlig: 'ß', euro: '€', hellip: '…', ndash: '–', mdash: '—',
  laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”', shy: '',
};

const entitaeten = (s) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (ganz, name) => (name in NAMEN ? NAMEN[name] : ganz));

const nurText = (html) => entitaeten(ohneSkripte(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

const attribut = (html, muster) => html.match(muster)?.[1]?.trim() ?? null;

const adresse = (datei) => {
  const rel = relative(WURZEL, datei).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
};

/* ------------------------------------------------------------- Einsammeln */

if (!existsSync(WURZEL)) {
  console.error(`FEHLER: ${WURZEL} gibt es nicht. Zuerst "npm run build" ausfuehren.`);
  process.exit(1);
}

const seitenDateien = dateien(WURZEL);

/*
 * Diese Prüfung hat sich zweimal selbst hereingelegt, weil die Seitenliste
 * leer war und trotzdem "keine Befunde" gemeldet wurde. Null geprüfte Seiten
 * ist kein bestandener Test, sondern ein Fehler.
 */
if (seitenDateien.length === 0) {
  console.error(`FEHLER: keine HTML-Datei unter ${WURZEL} gefunden. Nichts geprueft.`);
  process.exit(1);
}

const befunde = [];
const melde = (pfad, text) => befunde.push({ pfad, text });

const seiten = seitenDateien.map((datei) => {
  const html = readFileSync(datei, 'utf8');
  const kopf = html.slice(0, html.indexOf('</head>') + 7);
  const robots = attribut(kopf, /<meta\s+name="robots"\s+content="([^"]*)"/i) ?? '';
  return {
    datei,
    pfad: adresse(datei),
    html,
    kopf,
    text: nurText(html),
    // Aufgeloest gespeichert, damit Laengen der sichtbaren Zeichenzahl
    // entsprechen und nicht der Schreibweise im Quelltext.
    titel: attribut(kopf, /<title[^>]*>([\s\S]*?)<\/title>/i)
      ? entitaeten(attribut(kopf, /<title[^>]*>([\s\S]*?)<\/title>/i))
      : null,
    beschreibung: attribut(kopf, /<meta\s+name="description"\s+content="([^"]*)"/i)
      ? entitaeten(attribut(kopf, /<meta\s+name="description"\s+content="([^"]*)"/i))
      : null,
    canonical: attribut(kopf, /<link\s+rel="canonical"\s+href="([^"]*)"/i),
    robots,
    noindex: /noindex/i.test(robots),
    ogBild: attribut(kopf, /<meta\s+property="og:image"\s+content="([^"]*)"/i),
    ogTitel: attribut(kopf, /<meta\s+property="og:title"\s+content="([^"]*)"/i),
    lang: attribut(html, /<html[^>]+lang="([^"]*)"/i),
    ueberschriften: [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
      stufe: Number(m[1]),
      text: nurText(m[2]).trim(),
    })),
    bilder: [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]),
    strukturiert: [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(
      (m) => m[1],
    ),
  };
});

/* ---------------------------------------------------------- Einzelprüfung */

for (const s of seiten) {
  const p = s.pfad;

  if (!s.lang) melde(p, 'kein lang-Attribut am html-Element');
  if (!s.titel) melde(p, 'kein Titel');
  else if (s.titel.length > REGELN.titelMax)
    melde(p, `Titel ${s.titel.length} Zeichen, Google kuerzt ab etwa ${REGELN.titelMax}`);
  else if (s.titel.length < REGELN.titelMin) melde(p, `Titel nur ${s.titel.length} Zeichen`);

  if (!s.beschreibung) melde(p, 'keine Beschreibung');
  else if (
    s.beschreibung.length < REGELN.beschreibungMin ||
    s.beschreibung.length > REGELN.beschreibungMax
  )
    melde(
      p,
      `Beschreibung ${s.beschreibung.length} Zeichen (sinnvoll ${REGELN.beschreibungMin} bis ${REGELN.beschreibungMax})`,
    );

  if (!s.canonical) melde(p, 'kein canonical');
  else if (!/^https?:\/\//i.test(s.canonical)) melde(p, `canonical ist nicht absolut: ${s.canonical}`);
  else if (s.canonical.startsWith('http://')) melde(p, 'canonical zeigt auf http statt https');

  if (!s.robots) melde(p, 'kein robots-Meta');

  // og:image ist kein Pflichtfeld. Die Seite kommt bewusst ohne Bildmaterial
  // aus, also gibt es kein Motiv fuer die Vorschau beim Teilen. Gemeldet wird
  // deshalb nur ein vorhandenes, aber unbrauchbares Bild: ein relativer Pfad
  // funktioniert in OpenGraph nicht und wird von Diensten stillschweigend
  // ignoriert. Das Fehlen ist eine Entscheidung, ein relativer Pfad ein Fehler.
  if (s.ogBild && !/^https?:\/\//i.test(s.ogBild)) melde(p, 'og:image ist nicht absolut');
  if (!s.ogTitel) melde(p, 'kein og:title');

  const h1 = s.ueberschriften.filter((h) => h.stufe === 1);
  if (h1.length === 0) melde(p, 'keine h1');
  if (h1.length > 1) melde(p, `${h1.length} h1-Ueberschriften, es sollte genau eine sein`);

  // Sprung in der Gliederung, etwa h1 direkt auf h3. Screenreader lesen die
  // Struktur vor; eine uebersprungene Stufe wirkt dort wie eine Luecke.
  let vorher = 0;
  for (const h of s.ueberschriften) {
    if (vorher && h.stufe > vorher + 1)
      melde(p, `Ueberschriftensprung h${vorher} auf h${h.stufe} bei "${h.text.slice(0, 40)}"`);
    vorher = h.stufe;
  }

  for (const bild of s.bilder) {
    if (!/\balt=/.test(bild)) melde(p, `Bild ohne alt: ${bild.slice(0, 70)}`);
  }

  for (const roh of s.strukturiert) {
    try {
      const daten = JSON.parse(roh);
      const knoten = daten['@graph'] ?? [daten];
      if (!daten['@context']) melde(p, 'strukturierte Daten ohne @context');
      for (const k of knoten) if (!k['@type']) melde(p, 'strukturierte Daten: Knoten ohne @type');
    } catch {
      melde(p, 'strukturierte Daten sind kein gueltiges JSON');
    }
  }

  if (REGELN.keineGedankenstriche) {
    const treffer = s.text.match(/\S{0,24}[–—]\S{0,24}/g);
    if (treffer)
      for (const t of new Set(treffer)) melde(p, `Gedankenstrich im Text: "${t.trim()}"`);
  }
}

/* ------------------------------------------------------------- Dubletten */

const indexierbar = seiten.filter((s) => !s.noindex);
for (const [feld, name] of [
  ['titel', 'Titel'],
  ['beschreibung', 'Beschreibung'],
]) {
  const gesehen = new Map();
  for (const s of indexierbar) {
    const wert = s[feld];
    if (!wert) continue;
    if (!gesehen.has(wert)) gesehen.set(wert, []);
    gesehen.get(wert).push(s.pfad);
  }
  for (const [wert, pfade] of gesehen)
    if (pfade.length > 1)
      melde(pfade.join(', '), `gleicher ${name} auf mehreren Seiten: "${wert.slice(0, 60)}"`);
}

const h1Gesehen = new Map();
for (const s of indexierbar) {
  const erste = s.ueberschriften.find((h) => h.stufe === 1);
  if (!erste) continue;
  if (!h1Gesehen.has(erste.text)) h1Gesehen.set(erste.text, []);
  h1Gesehen.get(erste.text).push(s.pfad);
}
for (const [wert, pfade] of h1Gesehen)
  if (pfade.length > 1) melde(pfade.join(', '), `gleiche h1 auf mehreren Seiten: "${wert}"`);

/* ----------------------------------------------------------- Tote Verweise */

const vorhanden = (ziel) => {
  const ohneSchraegstrich = ziel.replace(/\/$/, '');
  const kandidaten = [
    join(WURZEL, ziel),
    join(WURZEL, ohneSchraegstrich),
    join(WURZEL, ohneSchraegstrich + '.html'),
    join(WURZEL, ohneSchraegstrich, 'index.html'),
  ];
  return kandidaten.some((k) => existsSync(k));
};

const gemeldeteZiele = new Set();
for (const s of seiten) {
  for (const m of s.html.matchAll(/href="(\/[^"#]*)"/g)) {
    const ziel = m[1];
    if (gemeldeteZiele.has(ziel)) continue;
    if (!vorhanden(ziel)) {
      gemeldeteZiele.add(ziel);
      melde(s.pfad, `Verweis ins Leere: ${ziel}`);
    }
  }
}

/* -------------------------------------------------- Sitemap und noindex */

const sitemapDatei = join(WURZEL, 'sitemap-0.xml');
const inSitemap = existsSync(sitemapDatei)
  ? [...readFileSync(sitemapDatei, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      new URL(m[1]).pathname,
    )
  : [];

for (const pfad of inSitemap) {
  const seite = seiten.find((s) => s.pfad === pfad || s.pfad === pfad + '/');
  if (seite?.noindex)
    melde(pfad, 'steht in der Sitemap und traegt zugleich noindex, das widerspricht sich');
}

const alleGesperrt = seiten.every((s) => s.noindex);
if (alleGesperrt && inSitemap.length > 0)
  melde('sitemap', 'alle Seiten stehen auf noindex, trotzdem gibt es eine Sitemap');

/* -------------------------------------------------------------- Ausgabe */

const zaehler = { indexierbar: indexierbar.length, gesperrt: seiten.length - indexierbar.length };

console.log(`\n${seiten.length} Seiten geprueft (${zaehler.indexierbar} indexierbar, ${zaehler.gesperrt} auf noindex)`);
console.log(`Sitemap: ${inSitemap.length} Adressen\n`);

console.log('Pfad'.padEnd(52) + 'Titel  Beschr.  Strukturierte Daten');
for (const s of seiten) {
  const typen = s.strukturiert
    .flatMap((roh) => {
      try {
        const d = JSON.parse(roh);
        return (d['@graph'] ?? [d]).map((k) => k['@type']);
      } catch {
        return [];
      }
    })
    .filter(Boolean);
  console.log(
    `${(s.noindex ? '· ' : '  ') + s.pfad}`.padEnd(52) +
      String(s.titel?.length ?? 0).padStart(5) +
      String(s.beschreibung?.length ?? 0).padStart(9) +
      '  ' +
      (typen.join('+') || '-'),
  );
}

console.log('\n--- Befunde ---');
if (befunde.length === 0) {
  console.log('  keine\n');
  process.exit(0);
}
for (const b of befunde) console.log(`  ${b.pfad}: ${b.text}`);
console.log(`\n${befunde.length} Befunde\n`);
process.exit(1);
