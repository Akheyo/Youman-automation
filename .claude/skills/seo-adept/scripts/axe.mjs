import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { seitenAusArgumenten } from './seiten.mjs';
const require = createRequire('/home/user/Youman-automation/adept-website/');
const axePfad = require.resolve('axe-core');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let gesamt = 0;
const SEITEN = seitenAusArgumenten();
for (const pfad of SEITEN) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://127.0.0.1:4321' + pfad, { waitUntil: 'networkidle' });
  await p.addScriptTag({ path: axePfad });
  const r = await p.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  gesamt += r.violations.length;
  console.log(`${r.violations.length === 0 ? 'OK  ' : 'FAIL'} ${pfad.padEnd(28)} ${r.violations.length} Verstoesse`);
  for (const v of r.violations) console.log(`      - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x)`);
  await p.close();
}
console.log(`\nSumme: ${gesamt} Verstoesse`);
await b.close();
