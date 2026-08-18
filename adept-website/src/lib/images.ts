import type { ImageMetadata } from 'astro';
import { bilder, type BildKey } from '../data/images';

/**
 * Alle Bilder aus src/assets/img werden zur Bauzeit eingesammelt. Dadurch
 * laufen sie durch die Bildpipeline von Astro: responsive Varianten, moderne
 * Formate und feste Abmessungen gegen Layout-Sprünge.
 *
 * Ablage: src/assets/img/<schluessel>.<endung>
 */
const dateien = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/img/*.{avif,webp,jpg,jpeg,png}',
  { eager: true },
);

/** Schlüssel -> Bilddaten, nach bevorzugter Endung aufgelöst. */
const ENDUNGEN = ['avif', 'webp', 'jpg', 'jpeg', 'png'] as const;

const register = new Map<string, ImageMetadata>();
for (const [pfad, modul] of Object.entries(dateien)) {
  const name = pfad.split('/').pop() ?? '';
  const punkt = name.lastIndexOf('.');
  const key = name.slice(0, punkt);
  const endung = name.slice(punkt + 1).toLowerCase();
  const bisher = register.get(key);
  if (!bisher) {
    register.set(key, modul.default);
    continue;
  }
  // Bei mehreren Formaten gewinnt das in ENDUNGEN weiter vorne stehende.
  const bisherigeEndung = bisher.src.split('.').pop()?.toLowerCase() ?? '';
  const rang = (e: string) => {
    const i = ENDUNGEN.indexOf(e as (typeof ENDUNGEN)[number]);
    return i === -1 ? ENDUNGEN.length : i;
  };
  if (rang(endung) < rang(bisherigeEndung)) register.set(key, modul.default);
}

export function bild(key: BildKey): { quelle: ImageMetadata; alt: string } | null {
  const alt = bilder[key];
  const quelle = register.get(key);
  if (!alt || !quelle) return null;
  return { quelle, alt };
}

/** Welche Bilder liegen vor? Für Diagnose und Doku. */
export function bildStatus(): { vorhanden: BildKey[]; fehlend: BildKey[] } {
  const keys = Object.keys(bilder) as BildKey[];
  return {
    vorhanden: keys.filter((k) => bild(k) !== null),
    fehlend: keys.filter((k) => bild(k) === null),
  };
}
