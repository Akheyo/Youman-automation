import fs from 'node:fs';
import path from 'node:path';
import { bilder, type BildKey } from '../data/images';
import { withBase } from './url';

const PUBLIC_IMG = path.resolve(process.cwd(), 'public/img');

/** Bevorzugte Reihenfolge: moderne Formate zuerst. */
const ENDUNGEN = ['avif', 'webp', 'jpg', 'jpeg', 'png'] as const;

/**
 * Sucht zur Bauzeit die passende Datei zum Schlüssel. Dadurch ist es egal,
 * in welchem Format ein Bild geliefert wird, und im Markup muss nirgends
 * unterschieden werden, ob es schon vorliegt.
 */
export function bild(key: BildKey): { src: string; alt: string } | null {
  const alt = bilder[key];
  if (!alt) return null;
  for (const endung of ENDUNGEN) {
    const datei = `${key}.${endung}`;
    try {
      if (fs.existsSync(path.join(PUBLIC_IMG, datei))) {
        return { src: withBase(`/img/${datei}`), alt };
      }
    } catch {
      /* Verzeichnis fehlt noch – dann gilt das Bild als nicht vorhanden. */
    }
  }
  return null;
}

/** Welche Bilder liegen bereits vor? Wird beim Build ausgegeben. */
export function bildStatus(): { vorhanden: BildKey[]; fehlend: BildKey[] } {
  const keys = Object.keys(bilder) as BildKey[];
  return {
    vorhanden: keys.filter((k) => bild(k) !== null),
    fehlend: keys.filter((k) => bild(k) === null),
  };
}
