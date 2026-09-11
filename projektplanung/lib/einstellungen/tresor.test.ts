/**
 * Testet die Verschlüsselung der Zugangsdaten.
 *
 * Die wichtigsten Prüfungen sind die negativen: Ein manipulierter oder mit
 * falschem Schlüssel gelesener Wert muss als „nicht lesbar" ankommen, nicht
 * als Müll oder als Absturz.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { entschluessele, maskiere, schluesselQuelle, tresorBereit, verschluessele } from './tresor';

describe('Tresor', () => {
  beforeEach(() => {
    process.env.EINSTELLUNGEN_SCHLUESSEL = 'ein-hinreichend-langes-geheimnis';
  });
  afterEach(() => {
    delete process.env.EINSTELLUNGEN_SCHLUESSEL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('verschlüsselt und entschlüsselt wieder', () => {
    const geheim = verschluessele('mein-plenty-passwort');
    expect(entschluessele(geheim)).toBe('mein-plenty-passwort');
  });

  it('lässt den Klartext nicht durchscheinen', () => {
    expect(verschluessele('mein-plenty-passwort')).not.toContain('mein-plenty-passwort');
  });

  it('erzeugt bei gleichem Klartext zwei verschiedene Geheimtexte', () => {
    // Sonst verriete allein der Vergleich, dass zwei Systeme dasselbe Passwort haben.
    expect(verschluessele('gleich')).not.toBe(verschluessele('gleich'));
  });

  it('erkennt Manipulation am Geheimtext', () => {
    const geheim = verschluessele('mein-plenty-passwort');
    const teile = geheim.split(':');
    const rohe = Buffer.from(teile[4], 'base64');
    rohe[0] ^= 0xff;
    teile[4] = rohe.toString('base64');
    expect(entschluessele(teile.join(':'))).toBeNull();
  });

  it('gibt null zurück, wenn der Schlüssel gewechselt hat', () => {
    const geheim = verschluessele('mein-plenty-passwort');
    process.env.EINSTELLUNGEN_SCHLUESSEL = 'ein-ganz-anderes-geheimnis';
    expect(entschluessele(geheim)).toBeNull();
  });

  it('verschluckt sich nicht an Unsinn', () => {
    expect(entschluessele(null)).toBeNull();
    expect(entschluessele('')).toBeNull();
    expect(entschluessele('nur-text')).toBeNull();
    expect(entschluessele('v9:a:b:c:d')).toBeNull();
  });

  it('kommt mit Umlauten und langen Werten zurecht', () => {
    const lang = 'Straße-Öl-Übung-' + 'x'.repeat(500);
    expect(entschluessele(verschluessele(lang))).toBe(lang);
  });

  it('weicht auf den Supabase-Schlüssel aus, wenn kein eigener gesetzt ist', () => {
    delete process.env.EINSTELLUNGEN_SCHLUESSEL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-schluessel';
    expect(tresorBereit()).toBe(true);
    expect(schluesselQuelle()).toBe('supabase');
    expect(entschluessele(verschluessele('abc'))).toBe('abc');
  });

  it('meldet, wenn gar kein Schlüssel da ist', () => {
    delete process.env.EINSTELLUNGEN_SCHLUESSEL;
    expect(tresorBereit()).toBe(false);
    expect(schluesselQuelle()).toBe('keiner');
    expect(() => verschluessele('abc')).toThrow(/Schlüssel/);
  });

  it('maskiert erkennbar, aber ohne zu verraten', () => {
    expect(maskiere('supergeheim1234')).toBe('••••••1234');
    expect(maskiere('ab')).toBe('••••');
    expect(maskiere(null)).toBeNull();
  });
});
