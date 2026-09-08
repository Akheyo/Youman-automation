import { describe, it, expect } from 'vitest';
import {
  mailboxes,
  warmupConfig,
  tagesErlaubnis,
  tageSeit,
  waehleMailbox,
  poolKapazitaet,
  type Mailbox,
  type MailboxAuslastung,
} from '@/lib/outreach/mailboxes';

const EIN_POSTFACH = {
  SMTP_HOST: 'smtps.udag.de',
  SMTP_USER: 'info@firma.de',
  SMTP_PASS: 'geheim',
  SMTP_PORT: '465',
};

const DREI_POSTFAECHER = {
  ...EIN_POSTFACH,
  SMTP_2_HOST: 'smtps.udag.de',
  SMTP_2_USER: 'kontakt@firma-zwei.de',
  SMTP_2_PASS: 'geheim2',
  SMTP_3_HOST: 'smtp.gmail.com',
  SMTP_3_USER: 'hallo@firma-drei.de',
  SMTP_3_PASS: 'geheim3',
  SMTP_3_PORT: '465',
  SMTP_3_FROM: 'vertrieb@firma-drei.de',
};

describe('mailboxes', () => {
  it('liest das erste Postfach ohne Nummer — bestehende Installationen bleiben unveraendert', () => {
    const pool = mailboxes(EIN_POSTFACH);
    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({ id: 'info@firma.de', from: 'info@firma.de' });
    expect(pool[0]!.settings).toMatchObject({ host: 'smtps.udag.de', port: 465, secure: true });
  });

  it('liest weitere Postfaecher ueber die Nummerierung', () => {
    const pool = mailboxes(DREI_POSTFAECHER);
    expect(pool.map((m) => m.id)).toEqual(['info@firma.de', 'kontakt@firma-zwei.de', 'vertrieb@firma-drei.de']);
  });

  it('nimmt SMTP_x_FROM als Absender, sonst den Benutzernamen', () => {
    const pool = mailboxes(DREI_POSTFAECHER);
    expect(pool[1]!.from).toBe('kontakt@firma-zwei.de');
    expect(pool[2]!.from).toBe('vertrieb@firma-drei.de');
  });

  it('gibt einen leeren Pool zurueck, wenn nichts eingerichtet ist', () => {
    expect(mailboxes({})).toEqual([]);
    expect(mailboxes({ SMTP_HOST: 'nur-host' })).toEqual([]);
  });

  it('bricht die Suche nicht bei einer Luecke ab', () => {
    // Postfach 2 fehlt, 3 ist da — beide sollen gefunden werden.
    const pool = mailboxes({
      ...EIN_POSTFACH,
      SMTP_3_HOST: 'h',
      SMTP_3_USER: 'drei@firma.de',
      SMTP_3_PASS: 'p',
    });
    expect(pool.map((m) => m.id)).toEqual(['info@firma.de', 'drei@firma.de']);
  });

  it('uebernimmt das Tageslimit global und je Postfach', () => {
    const pool = mailboxes({ ...DREI_POSTFAECHER, SMTP_DAILY_MAX: '300', SMTP_2_DAILY_MAX: '50' });
    expect(pool[0]!.dailyMax).toBe(300);
    expect(pool[1]!.dailyMax).toBe(50);
    expect(pool[2]!.dailyMax).toBe(300);
  });
});

describe('tageSeit', () => {
  const jetzt = new Date('2026-01-20T12:00:00Z');

  it('zaehlt volle Tage', () => {
    expect(tageSeit('2026-01-20T09:00:00Z', jetzt)).toBe(0);
    expect(tageSeit('2026-01-19T09:00:00Z', jetzt)).toBe(1);
    expect(tageSeit('2026-01-13T09:00:00Z', jetzt)).toBe(7);
  });

  it('kommt mit fehlendem oder kaputtem Datum klar', () => {
    expect(tageSeit(null, jetzt)).toBe(0);
    expect(tageSeit('unfug', jetzt)).toBe(0);
    expect(tageSeit('2026-02-01T00:00:00Z', jetzt)).toBe(0);
  });
});

describe('tagesErlaubnis', () => {
  const mb: Mailbox = {
    id: 'a@firma.de',
    from: 'a@firma.de',
    settings: { host: 'h', port: 465, secure: true, user: 'u', pass: 'p' },
    dailyMax: 200,
  };
  const cfg = { start: 15, step: 10 };

  it('faengt am ersten Tag klein an', () => {
    expect(tagesErlaubnis(mb, 0, cfg)).toBe(15);
  });

  it('steigert die Erlaubnis Tag fuer Tag', () => {
    expect(tagesErlaubnis(mb, 1, cfg)).toBe(25);
    expect(tagesErlaubnis(mb, 5, cfg)).toBe(65);
  });

  it('ueberschreitet nie das harte Tageslimit des Postfachs', () => {
    expect(tagesErlaubnis(mb, 100, cfg)).toBe(200);
  });

  it('behandelt negative Tage wie den ersten Tag', () => {
    expect(tagesErlaubnis(mb, -3, cfg)).toBe(15);
  });
});

describe('warmupConfig', () => {
  it('hat brauchbare Standardwerte', () => {
    expect(warmupConfig({})).toEqual({ start: 15, step: 10 });
  });

  it('laesst sich uebersteuern', () => {
    expect(warmupConfig({ SMTP_WARMUP_START: '5', SMTP_WARMUP_STEP: '3' })).toEqual({ start: 5, step: 3 });
  });
});

describe('waehleMailbox', () => {
  const pool = mailboxes(DREI_POSTFAECHER);
  const cfg = { start: 15, step: 10 };
  const jetzt = new Date('2026-01-20T12:00:00Z');
  const eingelaufen = '2026-01-01T09:00:00Z'; // laenger aktiv, volle Erlaubnis

  it('nimmt das Postfach mit der geringsten Tageslast', () => {
    const stand: Record<string, MailboxAuslastung> = {
      'info@firma.de': { heute: 10, ersterVersand: eingelaufen },
      'kontakt@firma-zwei.de': { heute: 3, ersterVersand: eingelaufen },
      'vertrieb@firma-drei.de': { heute: 7, ersterVersand: eingelaufen },
    };
    expect(waehleMailbox(pool, stand, cfg, jetzt)?.mailbox.id).toBe('kontakt@firma-zwei.de');
  });

  it('ueberspringt ausgeschoepfte Postfaecher', () => {
    const stand: Record<string, MailboxAuslastung> = {
      'info@firma.de': { heute: 200, ersterVersand: eingelaufen },
      'kontakt@firma-zwei.de': { heute: 200, ersterVersand: eingelaufen },
      'vertrieb@firma-drei.de': { heute: 4, ersterVersand: eingelaufen },
    };
    expect(waehleMailbox(pool, stand, cfg, jetzt)?.mailbox.id).toBe('vertrieb@firma-drei.de');
  });

  it('achtet auch bei frischen Postfaechern auf die Anwaerm-Grenze', () => {
    // Heute erstmals aktiv: nur 15 erlaubt, 15 sind schon raus.
    const stand: Record<string, MailboxAuslastung> = {
      'info@firma.de': { heute: 15, ersterVersand: jetzt.toISOString() },
      'kontakt@firma-zwei.de': { heute: 15, ersterVersand: jetzt.toISOString() },
      'vertrieb@firma-drei.de': { heute: 15, ersterVersand: jetzt.toISOString() },
    };
    expect(waehleMailbox(pool, stand, cfg, jetzt)).toBeNull();
  });

  it('behandelt ein noch nie benutztes Postfach als Tag eins', () => {
    const wahl = waehleMailbox(pool, {}, cfg, jetzt);
    expect(wahl?.mailbox.id).toBe('info@firma.de');
    expect(wahl?.rest).toBe(15);
  });

  it('gibt null zurueck, wenn der Pool leer ist', () => {
    expect(waehleMailbox([], {}, cfg, jetzt)).toBeNull();
  });
});

describe('poolKapazitaet', () => {
  it('summiert Erlaubnis und Verbrauch ueber alle Postfaecher', () => {
    const pool = mailboxes(DREI_POSTFAECHER);
    const jetzt = new Date('2026-01-20T12:00:00Z');
    const stand: Record<string, MailboxAuslastung> = {
      'info@firma.de': { heute: 5, ersterVersand: '2026-01-19T09:00:00Z' },
      'kontakt@firma-zwei.de': { heute: 2, ersterVersand: '2026-01-19T09:00:00Z' },
      'vertrieb@firma-drei.de': { heute: 0, ersterVersand: null },
    };
    // Zwei Postfaecher an Tag 1 (je 25), eines an Tag 0 (15).
    expect(poolKapazitaet(pool, stand, { start: 15, step: 10 }, jetzt)).toEqual({ erlaubt: 65, verbraucht: 7 });
  });
});
