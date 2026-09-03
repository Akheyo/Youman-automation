import { describe, it, expect } from 'vitest';
import { parseContactsCsv, splitName } from '@/lib/outreach/csv';

describe('splitName', () => {
  it('trennt Vor- und Nachname', () => {
    expect(splitName('Anna Beispiel')).toEqual({ first_name: 'Anna', last_name: 'Beispiel' });
  });

  it('nimmt bei Doppelnamen alles nach dem Vornamen als Nachname', () => {
    expect(splitName('Anna von Beispiel')).toEqual({ first_name: 'Anna', last_name: 'von Beispiel' });
  });

  it('kommt mit einem einzelnen Wort und mit Leerstring klar', () => {
    expect(splitName('Anna')).toEqual({ first_name: 'Anna' });
    expect(splitName('   ')).toEqual({});
  });
});

describe('parseContactsCsv', () => {
  it('liest eine Semikolon-Datei mit Kopfzeile', () => {
    const csv = 'email;vorname;firma;anlass\nanna@firma.de;Anna;Firma GmbH;Website ohne SSL';
    expect(parseContactsCsv(csv)).toEqual([
      { email: 'anna@firma.de', first_name: 'Anna', last_name: undefined, company: 'Firma GmbH', website: undefined, anlass: 'Website ohne SSL', custom: {} },
    ]);
  });

  it('liest ebenso eine Komma-Datei', () => {
    const rows = parseContactsCsv('email,name,firma\nb@firma.de,Bea Beispiel,B GmbH');
    expect(rows[0]).toMatchObject({ email: 'b@firma.de', first_name: 'Bea', last_name: 'Beispiel', company: 'B GmbH' });
  });

  it('behaelt unbekannte Spalten als freie Platzhalter', () => {
    const rows = parseContactsCsv('email;branche;mitarbeiter\na@b.de;Dachdecker;12');
    expect(rows[0]?.custom).toEqual({ branche: 'Dachdecker', mitarbeiter: '12' });
  });

  it('erkennt eine Datei ohne Kopfzeile in fester Spaltenfolge', () => {
    const rows = parseContactsCsv('a@b.de,Anna Beispiel,B GmbH,https://b.de');
    expect(rows[0]).toMatchObject({ email: 'a@b.de', first_name: 'Anna', company: 'B GmbH', website: 'https://b.de' });
  });

  it('vertraegt Anfuehrungszeichen und Trennzeichen im Feld', () => {
    const rows = parseContactsCsv('email;firma\na@b.de;"Muster; und Sohn GmbH"');
    expect(rows[0]?.company).toBe('Muster; und Sohn GmbH');
  });

  it('wirft ungueltige Adressen weg', () => {
    const rows = parseContactsCsv('email;firma\nkeine-adresse;X GmbH\nok@firma.de;Y GmbH');
    expect(rows.map((r) => r.email)).toEqual(['ok@firma.de']);
  });

  it('entfernt Dubletten und normalisiert auf Kleinschreibung', () => {
    const rows = parseContactsCsv('email\nAnna@Firma.de\nanna@firma.de');
    expect(rows.map((r) => r.email)).toEqual(['anna@firma.de']);
  });

  it('gibt bei leerer Eingabe eine leere Liste zurueck', () => {
    expect(parseContactsCsv('')).toEqual([]);
    expect(parseContactsCsv('\n\n')).toEqual([]);
  });
});
