/**
 * Reine Logik der Erfassung — ohne Netz, ohne Datenbank, damit sie testbar ist.
 *
 * Alles, was hier steht, entscheidet mit über die Qualität der späteren
 * Erkennung und Bepreisung: welche Aufnahmen verlangt werden, wann ein Artikel
 * als vollständig gilt und wie die Dateien im Storage heißen.
 */

export const ROLLEN = ['uebersicht', 'typenschild', 'schaden', 'detail'] as const;
export type Rolle = (typeof ROLLEN)[number];

/**
 * Pflichtaufnahmen. Ohne Übersicht kein Listing-Bild, ohne Typenschild keine
 * Modellnummer — und ohne Modellnummer keine Vergleichspreise. Alles andere
 * ist Kür.
 */
export const PFLICHT_ROLLEN: Rolle[] = ['uebersicht', 'typenschild'];

export const ROLLE_TEXT: Record<Rolle, string> = {
  uebersicht: 'Übersicht',
  typenschild: 'Typenschild',
  schaden: 'Zustand / Schaden',
  detail: 'Detail',
};

export const ROLLE_HINWEIS: Record<Rolle, string> = {
  uebersicht: 'Ganzer Artikel, gerade von vorn — das wird das erste Verkaufsbild.',
  typenschild: 'Nah genug, dass Hersteller und Modellnummer lesbar sind.',
  schaden: 'Kratzer, Rost, fehlende Teile. Lieber einmal zu viel.',
  detail: 'Anschlüsse, Zubehör, Besonderheiten.',
};

export function istRolle(wert: unknown): wert is Rolle {
  return typeof wert === 'string' && (ROLLEN as readonly string[]).includes(wert);
}

/** Status eines Artikels auf seinem Weg vom Regal ins Listing. */
export const STATUS = [
  'offen',
  'bereit',
  'erkannt',
  'bepreist',
  'listing',
  'freigabe',
  'veroeffentlicht',
  'fehler',
] as const;
export type Status = (typeof STATUS)[number];

export const STATUS_TEXT: Record<Status, string> = {
  offen: 'wird fotografiert',
  bereit: 'wartet auf Verarbeitung',
  erkannt: 'Merkmale erkannt',
  bepreist: 'Preis vorgeschlagen',
  listing: 'Listing erstellt',
  freigabe: 'wartet auf Freigabe',
  veroeffentlicht: 'veröffentlicht',
  fehler: 'Fehler',
};

export function istStatus(wert: unknown): wert is Status {
  return typeof wert === 'string' && (STATUS as readonly string[]).includes(wert);
}

/**
 * Obergrenze je Foto. Ein Handyfoto in voller Auflösung liegt bei 3–8 MB;
 * 30 MB fängt Ausreißer ab (Panorama, RAW), ohne die Qualität zu beschneiden,
 * um die es hier gerade geht.
 */
export const MAX_BILD_BYTES = 30 * 1024 * 1024;

const ENDUNGEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/**
 * Dateiendung aus Dateiname oder Content-Type — in dieser Reihenfolge, weil
 * iPhones je nach Einstellung HEIC liefern und der Content-Type dann
 * verlässlicher ist als der Name.
 */
export function dateiEndung(dateiname: string | null | undefined, contentType: string | null | undefined): string {
  const ausTyp = ENDUNGEN[(contentType ?? '').toLowerCase().split(';')[0].trim()];
  if (ausTyp) return ausTyp;
  const m = /\.([a-zA-Z0-9]{1,5})$/.exec(dateiname ?? '');
  if (m) return m[1].toLowerCase();
  return 'jpg';
}

/**
 * Pfad im Storage. Ein Ordner je Artikel, Dateiname aus Position und Rolle —
 * damit man im Supabase-Dashboard auf einen Blick sieht, was fehlt, ohne die
 * Datenbank daneben zu legen.
 */
export function bildPfad(artikelId: string, position: number, rolle: Rolle, endung: string): string {
  const nr = String(position).padStart(2, '0');
  return `${artikelId}/${nr}-${rolle}.${endung}`;
}

/** Prüft eine hochzuladende Datei. Gibt eine Meldung zurück oder null. */
export function validiereBild(datei: { contentType?: string | null; groesse?: number | null }): string | null {
  const typ = (datei.contentType ?? '').toLowerCase();
  if (!typ.startsWith('image/')) return 'Nur Bilddateien.';
  const groesse = datei.groesse ?? 0;
  if (groesse <= 0) return 'Die Datei ist leer.';
  if (groesse > MAX_BILD_BYTES) {
    return `Bild zu groß (${(groesse / 1024 / 1024).toFixed(1)} MB, erlaubt sind ${MAX_BILD_BYTES / 1024 / 1024} MB).`;
  }
  return null;
}

/** Nächste freie Position — Positionen bleiben stabil, auch wenn dazwischen gelöscht wurde. */
export function naechstePosition(bilder: Array<{ position: number }>): number {
  return bilder.reduce((max, b) => Math.max(max, b.position), 0) + 1;
}

/**
 * Welche Pflichtaufnahmen fehlen noch?
 *
 * Es zählen nur bestätigt hochgeladene Bilder. Ein Foto, das im Funkloch in der
 * Warteschlange hängt, ist noch keins — sonst gäbe der Artikel als vollständig
 * durch und das Typenschild fehlte hinterher.
 */
export function fehlendePflichtbilder(
  bilder: Array<{ rolle: string; hochgeladen: boolean }>,
): Rolle[] {
  const da = new Set(bilder.filter((b) => b.hochgeladen).map((b) => b.rolle));
  return PFLICHT_ROLLEN.filter((r) => !da.has(r));
}

/** Darf der Artikel abgeschickt werden? */
export function artikelBereit(bilder: Array<{ rolle: string; hochgeladen: boolean }>): boolean {
  return fehlendePflichtbilder(bilder).length === 0;
}

/** Menschenlesbare Begründung, warum "fertig" (noch) nicht geht. */
export function bereitHinweis(bilder: Array<{ rolle: string; hochgeladen: boolean }>): string | null {
  const fehlt = fehlendePflichtbilder(bilder);
  if (fehlt.length === 0) return null;
  return `Es fehlt noch: ${fehlt.map((r) => ROLLE_TEXT[r]).join(' und ')}.`;
}
