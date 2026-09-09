/**
 * Öffnungsmessung — das 1x1-Pixel und die Frage, ob ein Abruf ein Mensch war.
 *
 * Warum das nötig ist: seit Apple Mail Privacy Protection (2021) lädt Apple
 * Mail alle Bilder schon beim Empfang vor. Ohne Filter zählt damit jede Mail
 * an einen Apple-Nutzer als geöffnet. Firmen-Sicherheitsscanner (Proofpoint,
 * Mimecast, Barracuda …) machen dasselbe Sekunden nach dem Versand.
 *
 * Sicher unterscheiden lässt sich das nicht — Apples Vorablader gibt sich als
 * normaler Browser aus. Was hier passiert, ist deshalb Schadensbegrenzung:
 * offensichtliche Maschinen aussortieren und den Rest als das behandeln, was
 * er ist — ein Hinweis, keine Tatsache.
 */

/** Kleinstmögliches transparentes GIF (43 Byte). */
const PIXEL_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function pixelGif(): ArrayBuffer {
  const bytes = Buffer.from(PIXEL_BASE64, 'base64');
  // Als eigener ArrayBuffer, nicht als Sicht auf Node-internen Speicher.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Kopfzeilen, damit kein Zwischenspeicher den zweiten Abruf verschluckt. */
export const PIXEL_HEADERS: Record<string, string> = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

/**
 * Abrufer, die sich als Maschine zu erkennen geben. Google Image Proxy steht
 * bewusst NICHT hier: Gmail lädt das Bild erst, wenn die Mail geöffnet wird —
 * das ist ein echtes Signal.
 */
const MASCHINEN = [
  'proofpoint',
  'mimecast',
  'barracuda',
  'symantec',
  'messagelabs',
  'forcepoint',
  'trendmicro',
  'sophos',
  'cloudmark',
  'spamassassin',
  'bot',
  'crawler',
  'spider',
  'preview',
  'scanner',
  'monitoring',
  'curl',
  'wget',
  'python-requests',
  'okhttp',
  'go-http-client',
];

/**
 * Ein Abruf innerhalb dieser Spanne nach dem Versand ist praktisch immer ein
 * Vorablader — kein Mensch öffnet eine Kaltakquise-Mail in unter zehn
 * Sekunden.
 */
export const VORABLADER_FENSTER_MS = 10_000;

export interface PrefetchInput {
  userAgent?: string | null;
  sentAt?: Date | string | null;
  now?: Date;
}

/** True, wenn der Abruf nach Maschine aussieht und nicht als Öffnung zählt. */
export function isLikelyPrefetch(input: PrefetchInput): boolean {
  const ua = (input.userAgent ?? '').toLowerCase();
  if (!ua) return true; // Ein Mailclient schickt immer eine Kennung.
  if (MASCHINEN.some((m) => ua.includes(m))) return true;

  if (input.sentAt) {
    const sent = input.sentAt instanceof Date ? input.sentAt : new Date(input.sentAt);
    const now = input.now ?? new Date();
    const delta = now.getTime() - sent.getTime();
    if (Number.isFinite(delta) && delta >= 0 && delta < VORABLADER_FENSTER_MS) return true;
  }

  return false;
}

/** Absolute URL des Zählpixels für ein Versand-Token. */
export function pixelUrlFor(token: string): string | null {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  if (!base || !token) return null;
  return `${base}/api/outreach/p/${encodeURIComponent(token)}.gif`;
}

/** Ein Token je versendeter Mail — nicht erratbar, nicht auf den Kontakt rückführbar. */
export function newTrackToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '');
}
