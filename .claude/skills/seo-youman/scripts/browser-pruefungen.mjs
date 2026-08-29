#!/usr/bin/env node
/**
 * Die Prüfungen, die einen Browser brauchen, in einem Durchlauf:
 *
 *   1. Barrierefreiheit nach WCAG 2.1 A und AA (axe-core)
 *   2. Waagerechter Überlauf bei 320 bis 1440 px
 *   3. Layout-Sprung und Ladezeit (CLS, LCP)
 *   4. Anfragen an fremde Hosts, Cookies, Browser-Speicher
 *
 * Aufruf aus dem Projektstamm, mit laufendem Vorschauserver:
 *
 *   cd youman-website && npm run build && npx astro preview --port 4321 &
 *   node .claude/skills/seo-youman/scripts/browser-pruefungen.mjs
 *
 * Rückgabewert 0 heißt sauber, 1 heißt es gibt Befunde.
 */
import { readFileSync } from 'node:fs';
import { browserStarten, serverPruefen, axePfad } from './browser.mjs';
import { seitenPfade } from './seiten.mjs';

const BREITEN = [320, 375, 768, 1024, 1440];
const CLS_GRENZE = 0.1;
const LCP_GRENZE = 2500;

const basis = await serverPruefen();
const seiten = seitenPfade();
console.log(`${seiten.length} Seiten, Vorschau unter ${basis}\n`);

const browser = await browserStarten();
const befunde = [];
const melde = (pfad, text) => befunde.push(`${pfad}: ${text}`);

/* ------------------------------------------------------ Barrierefreiheit */

console.log('--- Barrierefreiheit (axe-core, WCAG 2.1 A und AA) ---');
if (!axePfad) {
  console.log('  uebersprungen, axe-core fehlt');
} else {
  let summe = 0;
  for (const pfad of seiten) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(basis + pfad, { waitUntil: 'networkidle' });
    await p.addScriptTag({ path: axePfad });
    const ergebnis = await p.evaluate(() =>
      window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      }),
    );
    summe += ergebnis.violations.length;
    for (const v of ergebnis.violations)
      melde(pfad, `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x)`);
    await p.close();
  }
  console.log(`  ${summe} Verstoesse\n`);
}

/* ------------------------------------------------------------- Überlauf */

console.log('--- Waagerechter Ueberlauf ---');
for (const breite of BREITEN) {
  const p = await browser.newPage({ viewport: { width: breite, height: 900 } });
  let betroffen = 0;
  for (const pfad of seiten) {
    await p.goto(basis + pfad, { waitUntil: 'networkidle' });
    const bericht = await p.evaluate((b) => {
      const doc = document.documentElement;
      if (doc.scrollWidth - doc.clientWidth <= 0) return null;
      const taeter = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right <= b + 1 && r.left >= -1) continue;
        // Absichtlich beschnittene Elemente zaehlen nicht, sonst meldet
        // jedes Bild in einer Kachel einen Fehler.
        let v = el.parentElement;
        let beschnitten = false;
        while (v && v !== document.body) {
          if (getComputedStyle(v).overflowX !== 'visible') {
            beschnitten = true;
            break;
          }
          v = v.parentElement;
        }
        if (!beschnitten)
          taeter.push(`${el.tagName}.${String(el.className).split(' ')[0]} bis ${Math.round(r.right)}`);
      }
      return { ueber: doc.scrollWidth - doc.clientWidth, taeter: taeter.slice(0, 3) };
    }, breite);
    if (bericht) {
      betroffen++;
      melde(pfad, `Ueberlauf bei ${breite} px um ${bericht.ueber} px: ${bericht.taeter.join(', ')}`);
    }
  }
  console.log(`  ${String(breite).padStart(4)} px: ${betroffen === 0 ? 'sauber' : betroffen + ' Seiten'}`);
  await p.close();
}
console.log();

/* -------------------------------------------------- Ladeverhalten (CWV) */

console.log('--- Layout-Sprung und Ladezeit, Mobilgroesse ---');
console.log('  Seite'.padEnd(52) + 'Bytes'.padStart(9) + 'LCP'.padStart(9) + 'CLS'.padStart(9));
let schwerste = { bytes: 0 };
for (const pfad of seiten) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await k.newPage();
  let bytes = 0;
  p.on('response', async (r) => {
    try {
      bytes += (await r.body()).length;
    } catch {
      /* Antworten ohne Koerper */
    }
  });
  await p.goto(basis + pfad, { waitUntil: 'networkidle' });
  const werte = await p.evaluate(
    () =>
      new Promise((fertig) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((l) => {
          const e = l.getEntries().at(-1);
          if (e) lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => fertig({ lcp, cls }), 1400);
      }),
  );
  if (bytes > schwerste.bytes) schwerste = { pfad, bytes };
  const auffaellig = werte.cls >= CLS_GRENZE || werte.lcp > LCP_GRENZE;
  console.log(
    `  ${pfad}`.padEnd(52) +
      `${(bytes / 1024).toFixed(0)}kB`.padStart(9) +
      `${werte.lcp.toFixed(0)}ms`.padStart(9) +
      werte.cls.toFixed(3).padStart(9) +
      (auffaellig ? '  <-' : ''),
  );
  if (werte.cls >= CLS_GRENZE) melde(pfad, `CLS ${werte.cls.toFixed(3)} ab ${CLS_GRENZE} mangelhaft`);
  if (werte.lcp > LCP_GRENZE) melde(pfad, `LCP ${werte.lcp.toFixed(0)} ms ueber ${LCP_GRENZE} ms`);
  await k.close();
}
console.log(`  schwerste Seite: ${schwerste.pfad} mit ${(schwerste.bytes / 1024).toFixed(0)} kB\n`);

/* --------------------------------------------- Fremde Hosts und Speicher */

console.log('--- Anfragen an Dritte, Cookies, Browser-Speicher ---');
const hosts = new Map();
for (const pfad of seiten) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('request', (r) => {
    const host = new URL(r.url()).host;
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
  });
  await p.goto(basis + pfad, { waitUntil: 'networkidle' });
  // Auch scrollen: verzoegert geladene Bilder loesen erst dann aus.
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(900);
  const speicher = await p.evaluate(() => ({
    cookies: document.cookie,
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }));
  if (speicher.cookies) melde(pfad, `setzt Cookies: ${speicher.cookies}`);
  if (speicher.local) melde(pfad, `${speicher.local} Eintraege im localStorage`);
  if (speicher.session) melde(pfad, `${speicher.session} Eintraege im sessionStorage`);
  await p.close();
}
const eigen = new URL(basis).host;
for (const [host, anzahl] of hosts) {
  const kennzeichen = host === eigen ? '   ' : '<- ';
  console.log(`  ${kennzeichen}${host.padEnd(30)} ${anzahl} Anfragen`);
  if (host !== eigen) melde('alle Seiten', `laedt von einem fremden Host: ${host}`);
}
console.log();

/* --------------------------------------------------------------- Fazit */

await browser.close();
console.log('--- Befunde ---');
if (befunde.length === 0) {
  console.log('  keine\n');
  process.exit(0);
}
for (const b of befunde) console.log('  ' + b);
console.log(`\n${befunde.length} Befunde\n`);
process.exit(1);
