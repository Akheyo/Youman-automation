import fs from 'node:fs'
import path from 'node:path'

/**
 * Findet Bild- und Videodateien anhand ihres Schlüssels.
 *
 * `public/bilder/brancheLogistik.webp` gehört zum Schlüssel `brancheLogistik`.
 * Dadurch reicht es, die Datei in den Ordner zu legen — niemand muss dafür
 * Code bearbeiten.
 *
 * Nur auf dem Server verwenden. Läuft beim Bauen, kostet zur Laufzeit nichts.
 */

const ENDUNGEN_BILD = ['webp', 'avif', 'jpg', 'jpeg', 'png']

function suchen(ordner: string, name: string, endungen: string[]) {
  for (const endung of endungen) {
    const datei = `${name}.${endung}`
    if (fs.existsSync(path.join(process.cwd(), 'public', ordner, datei))) {
      return `/${ordner}/${datei}`
    }
  }
  return undefined
}

export function bildDatei(schluessel: string) {
  return suchen('bilder', schluessel, ENDUNGEN_BILD)
}

export function videoQuellen(schluessel: string) {
  return {
    mp4: suchen('videos', schluessel, ['mp4']),
    webm: suchen('videos', schluessel, ['webm']),
    standbild: suchen('bilder', schluessel, ENDUNGEN_BILD),
  }
}
