/**
 * Versandplanung für Outreach-Sequenzen.
 *
 * Zwei Aufgaben: (1) entscheiden, ob eine Kampagne gerade senden darf
 * (Versandfenster, Wochenende), und (2) den Fälligkeitszeitpunkt des nächsten
 * Schritts berechnen. Kaltakquise-Mails, die nachts um 3 Uhr eintreffen,
 * sehen nach Maschine aus — deshalb wird jeder Termin in das nächste offene
 * Fenster gezogen und leicht gestreut, statt einen Schwung gleichzeitig zu
 * verschicken.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface SendWindow {
  window_start: number;
  window_end: number;
  timezone?: string | null;
  send_on_weekend?: boolean | null;
}

interface LocalParts {
  hour: number;
  minute: number;
  weekday: string;
}

/** Stunde/Minute/Wochentag in der Zeitzone der Kampagne. */
export function localParts(tz: string | null | undefined, at: Date): LocalParts {
  const zone = tz || 'Europe/Berlin';
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: zone }).formatToParts(at);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'Europe/Berlin' }).formatToParts(at);
  }
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    hour: parseInt(map.hour ?? '0', 10),
    minute: parseInt(map.minute ?? '0', 10),
    weekday: map.weekday ?? 'Mon',
  };
}

export function isWeekend(weekday: string): boolean {
  return weekday === 'Sat' || weekday === 'Sun';
}

/** Darf zu diesem Zeitpunkt gesendet werden? */
export function isWithinWindow(win: SendWindow, at: Date = new Date()): boolean {
  const { hour, weekday } = localParts(win.timezone, at);
  if (isWeekend(weekday) && !win.send_on_weekend) return false;
  return hour >= win.window_start && hour < win.window_end;
}

/**
 * Zieht einen Zeitpunkt auf den nächsten erlaubten Versandmoment vor bzw.
 * schiebt ihn nach hinten. Läuft in Stundenschritten, damit Zeitzonen und
 * Sommerzeit über Intl geregelt bleiben statt über eigene Datumsarithmetik.
 */
export function snapToWindow(win: SendWindow, at: Date): Date {
  const limit = 24 * 14; // maximal zwei Wochen vorspulen
  const cur = new Date(at.getTime());

  for (let i = 0; i < limit; i++) {
    const { hour, weekday } = localParts(win.timezone, cur);
    const weekendBlocked = isWeekend(weekday) && !win.send_on_weekend;
    if (!weekendBlocked && hour >= win.window_start && hour < win.window_end) {
      // Der Startzeitpunkt selbst liegt schon im Fenster.
      if (i === 0) return cur;
      // Beim Hineinlaufen auf den Stundenbeginn setzen (volle Stunde, 0 Sek.).
      cur.setTime(cur.getTime() - (cur.getTime() % HOUR));
      return cur;
    }
    cur.setTime(cur.getTime() + HOUR);
  }
  return cur;
}

/** Streuung, damit nicht alle Mails einer Charge dieselbe Sendezeit tragen. */
export function jitterMs(maxMinutes = 25): number {
  return Math.floor(Math.random() * Math.max(0, maxMinutes) * MIN);
}

/**
 * Fälligkeit des nächsten Schritts: Verzögerung in Tagen ab `from`, dann in
 * das nächste offene Versandfenster gezogen und gestreut.
 *
 * `delayDays = 0` heißt "sobald das Fenster offen ist" (typisch für Schritt 1).
 */
export function nextSendAt(win: SendWindow, delayDays: number, from: Date = new Date(), jitter = true): Date {
  const base = new Date(from.getTime() + Math.max(0, delayDays) * DAY);
  const snapped = snapToWindow(win, base);
  return jitter ? new Date(snapped.getTime() + jitterMs()) : snapped;
}

/**
 * Wie viele Mails dürfen in diesem Lauf noch raus? Das Tageslimit wird über
 * die verbleibenden offenen Fensterstunden verteilt, damit eine Kampagne mit
 * 40 Mails/Tag nicht um 8:05 Uhr komplett rausgeht.
 */
export function batchSize(win: SendWindow, remainingToday: number, at: Date = new Date()): number {
  if (remainingToday <= 0) return 0;
  const { hour } = localParts(win.timezone, at);
  const hoursLeft = Math.max(1, win.window_end - Math.max(hour, win.window_start));
  return Math.max(1, Math.ceil(remainingToday / hoursLeft));
}
