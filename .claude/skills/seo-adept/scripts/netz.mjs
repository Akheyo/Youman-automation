/**
 * Protokolliert jede Netzanfrage, die die Seite von sich aus stellt.
 * Grundlage fuer die Datenschutz-Uebersicht: was hier nicht auftaucht,
 * wird auch nicht an Dritte gesendet.
 */
import { chromium } from 'playwright';
import { seitenAusArgumenten } from './seiten.mjs';

const SEITEN = seitenAusArgumenten();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const hosts = new Map();

for (const pfad of SEITEN) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('request', (r) => {
    const host = new URL(r.url()).host;
    const eintrag = hosts.get(host) ?? { anzahl: 0, typen: new Set() };
    eintrag.anzahl++;
    eintrag.typen.add(r.resourceType());
    hosts.set(host, eintrag);
  });
  await p.goto('http://127.0.0.1:4321' + pfad, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  // Auch scrollen: lazy geladene Bilder loesen erst dann aus
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  const speicher = await p.evaluate(() => ({
    cookies: document.cookie,
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }));
  if (speicher.cookies || speicher.local || speicher.session) {
    console.log(`ACHTUNG ${pfad}: Cookies "${speicher.cookies}" localStorage ${speicher.local} sessionStorage ${speicher.session}`);
  }
  await p.close();
}

console.log('\n=== Angefragte Hosts ===');
for (const [host, e] of [...hosts].sort((a, b) => b[1].anzahl - a[1].anzahl)) {
  console.log(`${host.padEnd(28)} ${String(e.anzahl).padStart(4)} Anfragen  [${[...e.typen].join(', ')}]`);
}
console.log('\nKein Eintrag ausser 127.0.0.1 = die Seite laedt nichts von Dritten.');
await b.close();
