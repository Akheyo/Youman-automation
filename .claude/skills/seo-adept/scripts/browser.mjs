/**
 * Gemeinsamer Start für alle Prüfungen, die einen Browser brauchen.
 *
 * Zwei Dinge gingen hier schon schief und sind deshalb hier gebündelt:
 *
 * 1. Playwright lag nur im Sitzungsverzeichnis. Die Skripte liefen einmal
 *    und waren in der nächsten Sitzung kaputt. Es wird jetzt aus den
 *    Abhängigkeiten von adept-website aufgelöst, wo es als devDependency
 *    steht und mit `npm install` mitkommt.
 *
 * 2. Der Chromium-Pfad war fest verdrahtet, samt Versionsnummer im
 *    Verzeichnisnamen. Beim nächsten Playwright-Update zeigt der ins Leere.
 *    Gesucht wird jetzt der Reihe nach: die Vorgabe von Playwright selbst,
 *    dann PLAYWRIGHT_BROWSERS_PATH, dann bekannte Ablagen.
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PROJEKT = '/home/user/Youman-automation/adept-website/';
const require = createRequire(PROJEKT);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'FEHLER: playwright nicht gefunden.\n' +
      '  cd adept-website && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -D playwright axe-core',
  );
  process.exit(1);
}

/** Pfad zu axe-core, für Prüfungen die es einspielen. */
export const axePfad = (() => {
  try {
    return require.resolve('axe-core');
  } catch {
    return null;
  }
})();

function chromiumSuchen() {
  // Playwright kennt seinen Browser normalerweise selbst.
  try {
    const eigener = chromium.executablePath();
    if (eigener && existsSync(eigener)) return eigener;
  } catch {
    /* wirft, wenn nichts installiert ist */
  }

  const ablagen = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const ablage of ablagen) {
    if (!existsSync(ablage)) continue;
    // Direkt abgelegt, ohne Versionsverzeichnis
    const direkt = join(ablage, 'chromium');
    if (existsSync(direkt)) return direkt;
    // Sonst das neueste chromium-<version>-Verzeichnis
    const treffer = readdirSync(ablage)
      .filter((n) => n.startsWith('chromium'))
      .sort()
      .reverse();
    for (const name of treffer) {
      for (const rest of ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome']) {
        const pfad = join(ablage, name, rest);
        if (existsSync(pfad)) return pfad;
      }
    }
  }
  return null;
}

/** Startet Chromium. Bricht mit verständlicher Meldung ab, wenn keiner da ist. */
export async function browserStarten() {
  const pfad = chromiumSuchen();
  if (!pfad) {
    console.error(
      'FEHLER: kein Chromium gefunden.\n' +
        '  Entweder PLAYWRIGHT_BROWSERS_PATH setzen oder "npx playwright install chromium" ausfuehren.',
    );
    process.exit(1);
  }
  return chromium.launch({ executablePath: pfad });
}

/**
 * Prüft, ob unter der Adresse ein Vorschauserver läuft. Ohne diese Prüfung
 * scheitert jedes Skript mit einem Verbindungsfehler statt mit einem Hinweis,
 * was zu tun ist.
 */
export async function serverPruefen(basis = 'http://127.0.0.1:4321') {
  try {
    const antwort = await fetch(basis, { signal: AbortSignal.timeout(4000) });
    if (antwort.ok) return basis;
  } catch {
    /* faellt unten durch */
  }
  console.error(
    `FEHLER: unter ${basis} antwortet nichts.\n` +
      '  cd adept-website && npm run build && npx astro preview --port 4321',
  );
  process.exit(1);
}
