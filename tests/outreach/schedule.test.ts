import { describe, it, expect } from 'vitest';
import { isWithinWindow, snapToWindow, nextSendAt, localParts, batchSize, isWeekend } from '@/lib/outreach/schedule';

// Alle Zeiten in Europe/Berlin. Im Januar gilt MEZ (UTC+1).
const win = { window_start: 8, window_end: 18, timezone: 'Europe/Berlin', send_on_weekend: false };

// Mittwoch, 14. Januar 2026
const mittwoch10Uhr = new Date('2026-01-14T09:00:00Z'); // 10:00 lokal
const mittwoch6Uhr = new Date('2026-01-14T05:00:00Z'); // 06:00 lokal
const mittwoch22Uhr = new Date('2026-01-14T21:00:00Z'); // 22:00 lokal
const samstag10Uhr = new Date('2026-01-17T09:00:00Z'); // Sa 10:00 lokal

describe('localParts', () => {
  it('rechnet in die Zeitzone der Kampagne um', () => {
    expect(localParts('Europe/Berlin', mittwoch10Uhr)).toMatchObject({ hour: 10, weekday: 'Wed' });
  });

  it('faellt bei unbekannter Zeitzone auf Berlin zurueck', () => {
    expect(localParts('Mars/Olympus', mittwoch10Uhr).hour).toBe(10);
  });
});

describe('isWeekend', () => {
  it('erkennt Samstag und Sonntag', () => {
    expect(isWeekend('Sat')).toBe(true);
    expect(isWeekend('Sun')).toBe(true);
    expect(isWeekend('Mon')).toBe(false);
  });
});

describe('isWithinWindow', () => {
  it('erlaubt den Versand mitten im Fenster', () => {
    expect(isWithinWindow(win, mittwoch10Uhr)).toBe(true);
  });

  it('sperrt vor und nach dem Fenster', () => {
    expect(isWithinWindow(win, mittwoch6Uhr)).toBe(false);
    expect(isWithinWindow(win, mittwoch22Uhr)).toBe(false);
  });

  it('sperrt das Wochenende, solange es nicht freigegeben ist', () => {
    expect(isWithinWindow(win, samstag10Uhr)).toBe(false);
    expect(isWithinWindow({ ...win, send_on_weekend: true }, samstag10Uhr)).toBe(true);
  });
});

describe('snapToWindow', () => {
  it('laesst einen Zeitpunkt im Fenster unveraendert', () => {
    expect(snapToWindow(win, mittwoch10Uhr).getTime()).toBe(mittwoch10Uhr.getTime());
  });

  it('schiebt einen zu fruehen Zeitpunkt auf den Fensterbeginn', () => {
    const out = snapToWindow(win, mittwoch6Uhr);
    expect(localParts('Europe/Berlin', out)).toMatchObject({ hour: 8, weekday: 'Wed' });
  });

  it('schiebt einen Abendtermin auf den naechsten Morgen', () => {
    const out = snapToWindow(win, mittwoch22Uhr);
    expect(localParts('Europe/Berlin', out)).toMatchObject({ hour: 8, weekday: 'Thu' });
  });

  it('ueberspringt das Wochenende', () => {
    const out = snapToWindow(win, samstag10Uhr);
    expect(localParts('Europe/Berlin', out)).toMatchObject({ hour: 8, weekday: 'Mon' });
  });

  it('sendet am Wochenende, wenn es freigegeben ist', () => {
    const out = snapToWindow({ ...win, send_on_weekend: true }, samstag10Uhr);
    expect(out.getTime()).toBe(samstag10Uhr.getTime());
  });
});

describe('nextSendAt', () => {
  it('behaelt die Uhrzeit, wenn die Verzoegerung auf einem Werktag landet', () => {
    // Mi 10:00 + 2 Tage = Fr 10:00, mitten im Fenster.
    const out = nextSendAt(win, 2, mittwoch10Uhr, false);
    expect(localParts('Europe/Berlin', out)).toMatchObject({ hour: 10, weekday: 'Fri' });
  });

  it('schiebt einen Termin, der aufs Wochenende faellt, auf Montagfrueh', () => {
    // Mi 10:00 + 3 Tage = Sa 10:00 → gesperrt → Mo zum Fensterbeginn.
    const out = nextSendAt(win, 3, mittwoch10Uhr, false);
    expect(localParts('Europe/Berlin', out)).toMatchObject({ hour: 8, weekday: 'Mon' });
  });

  it('landet bei 0 Tagen im laufenden Fenster', () => {
    expect(nextSendAt(win, 0, mittwoch10Uhr, false).getTime()).toBe(mittwoch10Uhr.getTime());
  });

  it('streut die Sendezeit, aber hoechstens um eine halbe Stunde', () => {
    const ohne = nextSendAt(win, 0, mittwoch10Uhr, false).getTime();
    for (let i = 0; i < 40; i++) {
      const mit = nextSendAt(win, 0, mittwoch10Uhr, true).getTime();
      expect(mit).toBeGreaterThanOrEqual(ohne);
      expect(mit - ohne).toBeLessThan(30 * 60 * 1000);
    }
  });

  it('behandelt eine negative Verzoegerung wie sofort', () => {
    expect(nextSendAt(win, -5, mittwoch10Uhr, false).getTime()).toBe(mittwoch10Uhr.getTime());
  });
});

describe('batchSize', () => {
  it('verteilt das Tageslimit auf die restlichen Fensterstunden', () => {
    // 10:00 Uhr, Fenster bis 18:00 → 8 Stunden übrig, 40 Mails → 5 pro Lauf.
    expect(batchSize(win, 40, mittwoch10Uhr)).toBe(5);
  });

  it('sendet gegen Fensterende den Rest auf einmal', () => {
    const kurzVorSchluss = new Date('2026-01-14T16:00:00Z'); // 17:00 lokal
    expect(batchSize(win, 6, kurzVorSchluss)).toBe(6);
  });

  it('gibt ohne Restkontingent null zurueck', () => {
    expect(batchSize(win, 0, mittwoch10Uhr)).toBe(0);
  });

  it('sendet mindestens eine Mail, wenn noch etwas offen ist', () => {
    expect(batchSize(win, 1, mittwoch10Uhr)).toBe(1);
  });
});
