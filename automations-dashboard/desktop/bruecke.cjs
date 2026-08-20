/**
 * Schmale Brücke zwischen Fenster und Oberfläche. Sie reicht nur die
 * Zugangsdaten und die Version durch, sonst nichts.
 */

const { contextBridge } = require('electron');

function konfigurationLesen() {
  const vorsatz = '--automationen-konfiguration=';
  const treffer = process.argv.find((eintrag) => eintrag.startsWith(vorsatz));
  if (!treffer) return { url: '', schluessel: '', einstellungspfad: '', version: '' };
  try {
    return JSON.parse(Buffer.from(treffer.slice(vorsatz.length), 'base64').toString('utf8'));
  } catch {
    return { url: '', schluessel: '', einstellungspfad: '', version: '' };
  }
}

contextBridge.exposeInMainWorld('automationen', {
  istApp: true,
  ...konfigurationLesen(),
});
