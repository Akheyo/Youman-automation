import { describe, it, expect } from 'vitest';
import { collectChecks, versandBereit, isSet, OUTREACH_TABLES, type Env } from '@/lib/systemcheck';

const LEER: Env = {};

const PFLICHT_ERFUELLT: Env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  APP_URL: 'https://app.de',
};

const VOLL: Env = { ...PFLICHT_ERFUELLT, OUTREACH_WEBHOOK_URL: 'https://hook.de/mail', CRON_SECRET: 'geheim' };

const SMTP_ERFUELLT: Env = {
  ...PFLICHT_ERFUELLT,
  SMTP_HOST: 'smtp.firma.de',
  SMTP_USER: 'info@firma.de',
  SMTP_PASS: 'app-passwort',
  CRON_SECRET: 'geheim',
};

const SCHEMA_OK = { missing: [], veraltet: [], checked: OUTREACH_TABLES.length };

function check(env: Env, schema: Parameters<typeof collectChecks>[1], id: string) {
  return collectChecks(env, schema)
    .flatMap((g) => g.checks)
    .find((c) => c.id === id)!;
}

describe('isSet', () => {
  it('wertet Fehlen, Leerstring und Leerzeichen als nicht gesetzt', () => {
    expect(isSet({}, 'X')).toBe(false);
    expect(isSet({ X: '' }, 'X')).toBe(false);
    expect(isSet({ X: '   ' }, 'X')).toBe(false);
    expect(isSet({ X: 'wert' }, 'X')).toBe(true);
  });
});

describe('collectChecks', () => {
  it('meldet bei leerer Umgebung jeden Pflichtbaustein als offen', () => {
    const pflicht = collectChecks(LEER, null).find((g) => g.level === 'pflicht')!;
    expect(pflicht.checks.every((c) => !c.ok)).toBe(true);
    expect(pflicht.checks.map((c) => c.id)).toEqual(['supabase', 'service_role', 'app_url']);
  });

  it('haengt an jeden offenen Punkt einen naechsten Schritt', () => {
    const offen = collectChecks(LEER, null)
      .flatMap((g) => g.checks)
      .filter((c) => !c.ok);
    expect(offen.length).toBeGreaterThan(0);
    for (const c of offen) expect(c.hint && c.hint.length > 0).toBe(true);
  });

  it('hakt die Pflichtbausteine ab, sobald die Variablen stehen', () => {
    const pflicht = collectChecks(PFLICHT_ERFUELLT, SCHEMA_OK).find((g) => g.level === 'pflicht')!;
    expect(pflicht.checks.every((c) => c.ok)).toBe(true);
  });

  it('akzeptiert SMTP und Webhook als Versandweg', () => {
    const perSmtp = check({ ...SMTP_ERFUELLT }, SCHEMA_OK, 'sender');
    expect(perSmtp.ok).toBe(true);
    expect(perSmtp.detail).toContain('smtp.firma.de');

    const perWebhook = check(VOLL, SCHEMA_OK, 'sender');
    expect(perWebhook.ok).toBe(true);
    expect(perWebhook.detail).toContain('Webhook');

    const perFelix = check({ ...PFLICHT_ERFUELLT, FELIX_PITCH_WEBHOOK_URL: 'https://hook.de/pitch' }, SCHEMA_OK, 'sender');
    expect(perFelix.ok).toBe(true);
  });

  it('nennt die Absenderadresse, sobald sie vorgegeben ist', () => {
    const ohne = check(SMTP_ERFUELLT, SCHEMA_OK, 'absender');
    expect(ohne.ok).toBe(false);

    const mit = check({ ...SMTP_ERFUELLT, SMTP_FROM: 'info@firma.de' }, SCHEMA_OK, 'absender');
    expect(mit.ok).toBe(true);
    expect(mit.detail).toContain('info@firma.de');
  });

  it('verlangt eine Absenderadresse nur bei SMTP-Versand', () => {
    // Beim Webhook bestimmt der nachgelagerte Dienst den Absender.
    expect(check(VOLL, SCHEMA_OK, 'absender').ok).toBe(true);
  });

  it('meldet ein veraltetes Schema, wenn nur einzelne Spalten fehlen', () => {
    // Genau der Fall, der sonst erst beim Import als "schema cache"-Meldung
    // auffaellt.
    const c = check(VOLL, { missing: [], veraltet: ['outreach_contacts.mx_status'], checked: 5 }, 'schema');
    expect(c.ok).toBe(false);
    expect(c.detail).toContain('veraltet');
    expect(c.detail).toContain('mx_status');
  });

  it('blockiert den Versand, solange Spalten fehlen', () => {
    const groups = collectChecks(VOLL, { missing: [], veraltet: ['outreach_events.mailbox'], checked: 5 });
    expect(versandBereit(groups)).toBe(false);
  });

  it('unterscheidet fehlendes Schema von nicht pruefbarem Schema', () => {
    expect(check(VOLL, null, 'schema').detail).toContain('Konnte nicht geprüft werden');
    expect(check(VOLL, { missing: ['outreach_steps'], veraltet: [], checked: 5 }, 'schema').detail).toContain('outreach_steps');
    expect(check(VOLL, SCHEMA_OK, 'schema').ok).toBe(true);
  });

  it('nennt zu jedem offenen Punkt die zugehoerigen Variablen', () => {
    expect(check(LEER, null, 'supabase').vars).toEqual(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    expect(check(LEER, null, 'app_url').vars).toEqual(['APP_URL']);
  });

  it('gibt niemals einen Variablenwert zurueck', () => {
    const geheim = 'super-geheimer-schluessel-123';
    const alles = collectChecks({ ...VOLL, SUPABASE_SERVICE_ROLE_KEY: geheim, CRON_SECRET: geheim }, SCHEMA_OK);
    expect(JSON.stringify(alles)).not.toContain(geheim);
  });
});

describe('versandBereit', () => {
  it('ist erst wahr, wenn Pflicht und Outreach stehen', () => {
    expect(versandBereit(collectChecks(LEER, null))).toBe(false);
    // Versandweg fehlt noch.
    expect(versandBereit(collectChecks(PFLICHT_ERFUELLT, SCHEMA_OK))).toBe(false);
    expect(versandBereit(collectChecks(VOLL, SCHEMA_OK))).toBe(true);
  });

  it('haelt ein fehlendes Cron-Geheimnis nicht fuer einen Blocker', () => {
    expect(versandBereit(collectChecks({ ...VOLL, CRON_SECRET: '' }, SCHEMA_OK))).toBe(true);
  });

  it('blockiert, solange das Schema fehlt', () => {
    expect(versandBereit(collectChecks(VOLL, { missing: ['outreach_contacts'], veraltet: [], checked: 5 }))).toBe(false);
  });

  it('ist auch mit SMTP statt Webhook erfuellt', () => {
    expect(versandBereit(collectChecks(SMTP_ERFUELLT, SCHEMA_OK))).toBe(true);
  });

  it('haelt eine fehlende Absenderadresse nicht fuer einen Blocker', () => {
    // Ohne SMTP_FROM greift die Adresse aus der Kampagne.
    expect(versandBereit(collectChecks(SMTP_ERFUELLT, SCHEMA_OK))).toBe(true);
  });

  it('laesst sich von fehlenden Zusatzdiensten nicht aufhalten', () => {
    // Weder Vapi noch Stripe noch Sentry sind gesetzt.
    expect(versandBereit(collectChecks(VOLL, SCHEMA_OK))).toBe(true);
  });
});
