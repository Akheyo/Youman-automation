import { describe, it, expect } from 'vitest';
import { smtpSettings, smtpConfigured, smtpFrom, erklaereSmtpFehler } from '@/lib/outreach/smtp';

const VOLL = { SMTP_HOST: 'smtp.firma.de', SMTP_USER: 'info@firma.de', SMTP_PASS: 'geheim' };

describe('smtpSettings', () => {
  it('liest Host, Benutzer und Passwort', () => {
    expect(smtpSettings(VOLL)).toMatchObject({ host: 'smtp.firma.de', user: 'info@firma.de', pass: 'geheim' });
  });

  it('nimmt ohne Angabe Port 587 mit STARTTLS', () => {
    expect(smtpSettings(VOLL)).toMatchObject({ port: 587, secure: false });
  });

  it('schaltet bei Port 465 automatisch auf TLS', () => {
    expect(smtpSettings({ ...VOLL, SMTP_PORT: '465' })).toMatchObject({ port: 465, secure: true });
  });

  it('laesst sich per SMTP_SECURE uebersteuern', () => {
    expect(smtpSettings({ ...VOLL, SMTP_PORT: '2525', SMTP_SECURE: 'true' })?.secure).toBe(true);
    expect(smtpSettings({ ...VOLL, SMTP_PORT: '465', SMTP_SECURE: 'false' })?.secure).toBe(false);
    expect(smtpSettings({ ...VOLL, SMTP_PORT: '465', SMTP_SECURE: '1' })?.secure).toBe(true);
  });

  it('faellt bei unbrauchbarem Port auf 587 zurueck', () => {
    expect(smtpSettings({ ...VOLL, SMTP_PORT: 'abc' })?.port).toBe(587);
    expect(smtpSettings({ ...VOLL, SMTP_PORT: '-1' })?.port).toBe(587);
  });

  it('gibt null zurueck, solange etwas fehlt', () => {
    expect(smtpSettings({})).toBeNull();
    expect(smtpSettings({ SMTP_HOST: 'smtp.firma.de' })).toBeNull();
    expect(smtpSettings({ ...VOLL, SMTP_PASS: '   ' })).toBeNull();
  });

  it('smtpConfigured spiegelt genau das', () => {
    expect(smtpConfigured(VOLL)).toBe(true);
    expect(smtpConfigured({})).toBe(false);
  });
});

describe('smtpFrom', () => {
  it('liefert die vorgegebene Absenderadresse ohne Leerzeichen', () => {
    expect(smtpFrom({ SMTP_FROM: '  info@firma.de ' })).toBe('info@firma.de');
    expect(smtpFrom({})).toBe('');
  });
});

describe('erklaereSmtpFehler', () => {
  it('erklaert eine abgelehnte Anmeldung mit dem App-Passwort', () => {
    const t = erklaereSmtpFehler('535-5.7.8 Username and Password not accepted');
    expect(t).toContain('App-Passwort');
  });

  it('erkennt einen unbekannten Host', () => {
    expect(erklaereSmtpFehler('getaddrinfo ENOTFOUND smtp.tippfehler.de')).toContain('SMTP_HOST');
  });

  it('deutet eine Zeitueberschreitung als falschen Port', () => {
    expect(erklaereSmtpFehler('Connection timeout ETIMEDOUT')).toContain('Port');
  });

  it('erkennt eine verweigerte Zustellung', () => {
    expect(erklaereSmtpFehler('550 5.7.1 Relay access denied')).toContain('Absenderadresse');
  });

  it('reicht unbekannte Meldungen unveraendert durch', () => {
    expect(erklaereSmtpFehler('Irgendwas Seltsames')).toBe('Irgendwas Seltsames');
  });
});
