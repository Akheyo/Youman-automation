/**
 * Sucht waagerechten Ueberlauf auf allen Seiten und allen Breiten.
 *
 * Elemente, die absichtlich beschnitten werden (ein Vorfahr mit overflow !=
 * visible), zaehlen nicht - sonst meldet jedes Bild in einer Kachel einen
 * Fehler.
 */
import { chromium } from 'playwright';

import { seitenAusArgumenten } from './seiten.mjs';

// Ohne Argumente alle gebauten Seiten. Eine leere Liste waere ein stiller
// Fehlschlag: sie meldet "nichts gefunden", weil nichts geprueft wurde.
const SEITEN = seitenAusArgumenten();
const BREITEN = [320, 375, 768, 1024, 1440];

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

let fehler = 0;
for (const breite of BREITEN) {
  const p = await b.newPage({ viewport: { width: breite, height: 900 } });
  for (const pfad of SEITEN) {
    await p.goto('http://127.0.0.1:4321' + pfad, { waitUntil: 'networkidle' });
    const bericht = await p.evaluate((breite) => {
      const doc = document.documentElement;
      const seite = doc.scrollWidth - doc.clientWidth;
      const taeter = [];
      if (seite > 0) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right <= breite + 1 && r.left >= -1) continue;
          let v = el.parentElement,
            beschnitten = false;
          while (v && v !== document.body) {
            if (getComputedStyle(v).overflowX !== 'visible') {
              beschnitten = true;
              break;
            }
            v = v.parentElement;
          }
          if (!beschnitten) {
            taeter.push(
              `${el.tagName}.${(el.className || '').toString().split(' ')[0]} "${(el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.left)}..${Math.round(r.right)}`,
            );
          }
        }
      }
      return { seite, taeter: taeter.slice(0, 3) };
    }, breite);

    if (bericht.seite > 0) {
      fehler++;
      console.log(`FAIL ${String(breite).padStart(4)}px ${pfad.padEnd(46)} +${bericht.seite}px`);
      for (const t of bericht.taeter) console.log('        ' + t);
    }
  }
  await p.close();
  console.log(`  ${String(breite).padStart(4)}px durchgeprueft (${SEITEN.length} Seiten)`);
}
console.log(fehler === 0 ? '\nOK: kein waagerechter Ueberlauf' : `\n${fehler} Fund(e)`);
await b.close();
