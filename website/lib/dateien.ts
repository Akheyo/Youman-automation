import fs from 'node:fs'
import path from 'node:path'
import { bilder } from './bilder'

/**
 * Findet Bild- und Videodateien im Ordner `public/`.
 *
 * Die Zuordnung läuft über den Dateinamen und ist absichtlich großzügig:
 * Groß- und Kleinschreibung, Umlaute, Leerzeichen, Binde- und Kaufmannsund
 * werden ignoriert. `Spedition&Logistik.png`, `spedition-logistik.webp` und
 * `brancheLogistik.jpg` landen alle an derselben Stelle.
 *
 * Nur auf dem Server verwenden. Läuft beim Bauen, kostet zur Laufzeit nichts.
 */

const ENDUNGEN_BILD = ['webp', 'avif', 'jpg', 'jpeg', 'png']

/** Reduziert einen Namen auf reine Kleinbuchstaben und Ziffern. */
function normalisieren(wert: string) {
  return wert
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
}

function dateienIm(ordner: string) {
  const pfad = path.join(process.cwd(), 'public', ordner)
  try {
    return fs.readdirSync(pfad)
  } catch {
    return []
  }
}

/**
 * Sucht eine Datei, deren Name zu einem der akzeptierten Namen passt.
 * Ein Treffer liegt vor, wenn der normalisierte Dateiname einem Namen
 * entspricht oder mit ihm beginnt — damit greift auch
 * `Grosshandel&Distrubition.png` bei einem Tippfehler im hinteren Teil.
 */
function suchen(ordner: string, namen: string[], endungen: string[]) {
  const dateien = dateienIm(ordner)
  const kandidaten = namen.map(normalisieren).filter((n) => n.length >= 4)

  for (const datei of dateien) {
    const endung = path.extname(datei).slice(1).toLowerCase()
    if (!endungen.includes(endung)) continue

    const basis = normalisieren(path.basename(datei, path.extname(datei)))
    if (kandidaten.some((k) => basis === k || basis.startsWith(k))) {
      return `/${ordner}/${datei}`
    }
  }
  return undefined
}

export function bildDatei(schluessel: string) {
  const eintrag = bilder[schluessel as keyof typeof bilder] as { namen?: string[] }
  // Der Schlüssel selbst zählt immer, zusätzliche Namen kommen aus dem Register.
  const namen = [schluessel, ...(eintrag?.namen ?? [])]
  return suchen('bilder', namen, ENDUNGEN_BILD)
}

export function videoQuellen(schluessel: string) {
  const namen = [schluessel, 'hero', 'startvideo']
  return {
    mp4: suchen('videos', namen, ['mp4']),
    webm: suchen('videos', namen, ['webm']),
    standbild: suchen('bilder', [`${schluessel}standbild`, `${schluessel}poster`], ENDUNGEN_BILD),
  }
}
