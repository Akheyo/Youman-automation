/**
 * Seitenliste aus dem gebauten Verzeichnis ermitteln.
 *
 * Gemeinsam genutzt, damit keine Prüfung mehr auf eine leere Liste läuft und
 * dann "keine Befunde" meldet. Null geprüfte Seiten ist ein Fehler, kein
 * bestandener Test.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export function seitenPfade(distVerzeichnis = 'youman-website/dist') {
  const wurzel = resolve(distVerzeichnis);
  if (!existsSync(wurzel)) {
    console.error(`FEHLER: ${wurzel} gibt es nicht. Zuerst "npm run build" ausfuehren.`);
    process.exit(1);
  }

  const gefunden = [];
  const gehen = (pfad) => {
    for (const eintrag of readdirSync(pfad)) {
      const voll = join(pfad, eintrag);
      if (statSync(voll).isDirectory()) gehen(voll);
      else if (eintrag.endsWith('.html')) gefunden.push(voll);
    }
  };
  gehen(wurzel);

  if (gefunden.length === 0) {
    console.error(`FEHLER: keine HTML-Datei unter ${wurzel}. Nichts zu pruefen.`);
    process.exit(1);
  }

  return gefunden
    .map((datei) => {
      const rel = relative(wurzel, datei).replace(/\\/g, '/');
      if (rel === 'index.html') return '/';
      if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
      return '/' + rel;
    })
    .sort();
}

/** Argumente von der Kommandozeile, sonst alles aus dist. */
export function seitenAusArgumenten(argv = process.argv.slice(2)) {
  const pfade = argv.filter((a) => a.startsWith('/'));
  return pfade.length > 0 ? pfade : seitenPfade();
}
