/**
 * Oeffnungszeiten — eine einzige Quelle fuer Website, Schema.org und die
 * Bestellannahme.
 *
 * Genau hier liegt einer der Befunde aus dem SEO-Audit: die Zeiten im
 * JSON-LD der aktuellen Seite widersprechen den sichtbaren Zeiten. Wenn der
 * Shop live geht, entscheidet diese Datei, ob eine Bestellung angenommen wird
 * — sie muss also mit dem stimmen, was Gaeste lesen. Aus ihr sollten Website
 * und Schema.org-Markup generiert werden, nicht umgekehrt.
 *
 * Werte unten: die auf der Seite sichtbaren Zeiten (nicht die aus dem Schema).
 * Vor dem Livegang bestaetigen lassen.
 */

export interface Fenster {
  von: string; // "11:30"
  bis: string; // "14:30"
}

/** Index 0 = Sonntag, wie bei Date.getDay(). */
export const ZEITEN: Fenster[][] = [
  [{ von: '11:30', bis: '22:00' }], // So
  [{ von: '11:30', bis: '14:30' }, { von: '17:30', bis: '22:00' }], // Mo
  [{ von: '11:30', bis: '14:30' }, { von: '17:30', bis: '22:00' }], // Di
  [{ von: '17:00', bis: '22:00' }], // Mi
  [{ von: '11:30', bis: '14:30' }, { von: '17:30', bis: '22:00' }], // Do
  [{ von: '11:30', bis: '22:00' }], // Fr
  [{ von: '11:30', bis: '22:00' }], // Sa
];

/** Letzte Annahme vor Schliessung, in Minuten — danach wird nichts mehr fertig. */
const ANNAHMESCHLUSS_PUFFER = 20;

function minuten(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Aktuelle Ortszeit in Borken, unabhaengig von der Server-Zeitzone. */
function jetztInBorken(now: Date): { tag: number; minute: number } {
  const teile = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const finde = (t: string) => teile.find((p) => p.type === t)?.value ?? '0';
  const kurz = finde('weekday').slice(0, 2).toLowerCase();
  const tage: Record<string, number> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
  return { tag: tage[kurz] ?? 0, minute: Number(finde('hour')) * 60 + Number(finde('minute')) };
}

/**
 * Nimmt die Kueche gerade Bestellungen an?
 *
 * Feiertage sind hier bewusst nicht abgebildet — an Feiertagen gelten laut
 * Aushang die Sonntagszeiten, und geschlossene Tage werden ueber den
 * Notausschalter in der Verwaltung gesetzt (siehe README).
 */
export function nimmtBestellungenAn(now: Date = new Date()): boolean {
  const { tag, minute } = jetztInBorken(now);
  return ZEITEN[tag].some((f) => minute >= minuten(f.von) && minute <= minuten(f.bis) - ANNAHMESCHLUSS_PUFFER);
}

/** Menschenlesbarer Hinweis fuer die Absage im Warenkorb. */
export function naechsteOeffnung(now: Date = new Date()): string {
  const { tag, minute } = jetztInBorken(now);
  const heute = ZEITEN[tag].find((f) => minute < minuten(f.von));
  if (heute) return `Wir nehmen ab ${heute.von} Uhr wieder Bestellungen an.`;
  const namen = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const morgen = (tag + 1) % 7;
  return `Wir nehmen ${namen[morgen]} ab ${ZEITEN[morgen][0].von} Uhr wieder Bestellungen an.`;
}
