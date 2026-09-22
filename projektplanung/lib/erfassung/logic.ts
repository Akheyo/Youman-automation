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
 * Rollen, wie die Bilderkennung sie vergibt — inklusive „unbrauchbar" für
 * verwackelte oder überbelichtete Aufnahmen.
 *
 * Wer am Regal fotografiert, vergibt KEINE Rollen mehr. Das war ein Formular
 * vor der Kamera: vier Kacheln abarbeiten, bevor man auslösen darf. Wofür ein
 * Foto taugt, sieht man dem Foto an — das kann die Auswertung hinterher
 * entscheiden, und sie tut es zuverlässiger als jemand mit vollen Händen.
 */
export const ERKANNTE_ROLLEN = [...ROLLEN, 'unbrauchbar'] as const;
export type ErkannteRolle = (typeof ERKANNTE_ROLLEN)[number];

export const ERKANNTE_ROLLE_TEXT: Record<ErkannteRolle, string> = {
  uebersicht: 'Übersicht',
  typenschild: 'Typenschild',
  schaden: 'Schaden',
  detail: 'Detail',
  unbrauchbar: 'unbrauchbar',
};

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
 * Wie viele Fotos sind bestätigt oben?
 *
 * Es zählen nur bestätigt hochgeladene Bilder. Ein Foto, das im Funkloch in
 * der Warteschlange hängt, ist noch keins — sonst ginge der Artikel als
 * vollständig durch und käme mit halbem Bildsatz in die Auswertung.
 */
export function anzahlOben(bilder: Array<{ hochgeladen: boolean }>): number {
  return bilder.filter((b) => b.hochgeladen).length;
}

/**
 * Darf der Artikel abgeschickt werden?
 *
 * Eine einzige Bedingung: mindestens ein Foto ist oben. Es gibt bewusst keine
 * Pflicht-Perspektiven mehr — was auf den Fotos fehlt, sagt die Auswertung
 * hinterher (z. B. „kein lesbares Typenschild"), statt es vorher zu verlangen.
 * Ein fehlendes Typenschild ist ein Hinweis, kein Grund, jemanden am Regal
 * stehen zu lassen.
 */
export function artikelBereit(bilder: Array<{ hochgeladen: boolean }>): boolean {
  return anzahlOben(bilder) > 0;
}

/** Menschenlesbare Begründung, warum "fertig" (noch) nicht geht. */
export function bereitHinweis(bilder: Array<{ hochgeladen: boolean }>): string | null {
  return artikelBereit(bilder) ? null : 'Mindestens ein Foto machen.';
}

// ---------------------------------------------------------------------------
// Zustand und Bestand
// ---------------------------------------------------------------------------

import { ZUSTAND_TEXT as PREIS_ZUSTAND_TEXT, type Zustand } from '@/lib/preis/regelwerk';

export { PREIS_ZUSTAND_TEXT };

export const MAX_BESTAND = 9999;

/**
 * Schwerstes Paket, das wir noch annehmen — darüber geht nur Spedition.
 * 300 kg ist keine Grenze der Logistik, sondern eine gegen den Zahlendreher:
 * Wer 2,5 kg als 2500 eintippt, soll das gesagt bekommen.
 */
export const MAX_GEWICHT_KG = 300;

export type Packklasse = 'normal' | 'sperrig' | 'schwierig';

export interface Angaben {
  zustand: Zustand;
  zustandBestaetigt: boolean;
  gravierendeSchaeden: boolean;
  bestand: number;
  /** Ohne Gewicht kein Versandsatz und damit kein belastbarer Verkaufspreis. */
  gewichtKg: number | null;
  packklasse: Packklasse;
}

function istZustand(wert: unknown): wert is Zustand {
  return wert === 'neu_versiegelt' || wert === 'neu' || wert === 'gebraucht' || wert === 'defekt';
}

function istPackklasse(wert: unknown): wert is Packklasse {
  return wert === 'normal' || wert === 'sperrig' || wert === 'schwierig';
}

/**
 * Das Gewicht, gerundet auf Gramm und auf Plausibilität geprüft.
 *
 * Null heißt ausdrücklich „nicht gewogen" und ist ein gültiger Wert: Der
 * Artikel wird dann trotzdem angelegt, und das fehlende Versandprofil steht
 * als offener Punkt daran. Geraten wird nicht — ein geschätztes Gewicht
 * verschiebt über die Versandstaffel unmittelbar den Verkaufspreis.
 */
export function normalisiereGewicht(roh: unknown): number | null {
  const zahl = Number(roh);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  return Math.min(Math.round(zahl * 1000) / 1000, MAX_GEWICHT_KG);
}

/**
 * Bringt die Angaben vom Handy in eine Form, auf die sich die Preisfindung
 * verlassen kann.
 *
 * Zwei Dinge werden dabei stillschweigend geradegezogen, weil sie sonst
 * später falsche Preise erzeugen:
 *
 * 1. Ein unbekannter Zustand wird „gebraucht" — bei einer Verwertung der
 *    Regelfall, und ein erfundener Wert wäre schlimmer als der häufigste.
 * 2. „Gravierende Schäden" gilt nur bei Gebrauchtware. Bei neuer Ware ergibt
 *    es keinen Sinn, bei defekter ist es bereits im Zustand enthalten — sonst
 *    zöge der Faktor doppelt ab.
 * 3. Die Packklasse zählt erst über 10 kg. Darunter kostet der Versand
 *    ohnehin denselben Satz, und „sperrig" an einer 2-kg-Sendung wäre eine
 *    Angabe, die nichts bewirkt, aber im Büro nach Absicht aussieht.
 */
export function normalisiereAngaben(roh: Partial<Record<keyof Angaben, unknown>>): Angaben {
  const zustand: Zustand = istZustand(roh.zustand) ? roh.zustand : 'gebraucht';
  const zahl = Number(roh.bestand);
  const bestand = Number.isFinite(zahl) ? Math.min(Math.max(Math.round(zahl), 1), MAX_BESTAND) : 1;
  const gewichtKg = normalisiereGewicht(roh.gewichtKg);
  const gewaehlt: Packklasse = istPackklasse(roh.packklasse) ? roh.packklasse : 'normal';
  return {
    zustand,
    zustandBestaetigt: roh.zustandBestaetigt === true,
    gravierendeSchaeden: zustand === 'gebraucht' && roh.gravierendeSchaeden === true,
    bestand,
    gewichtKg,
    packklasse: gewichtKg != null && gewichtKg > 10 ? gewaehlt : 'normal',
  };
}
