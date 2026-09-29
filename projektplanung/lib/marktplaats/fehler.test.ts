import { describe, expect, it } from 'vitest';
import { fehlerText, istUnbekannteAnzeige, leseFehler, lohntWiederholung, titelGrenzeAus } from './fehler';

describe('leseFehler', () => {
  it('liest Code und Meldung', () => {
    const b = leseFehler(400, JSON.stringify({ code: 'validation-failure', message: 'Validation of the profile failed.' }));
    expect(b.code).toBe('validation-failure');
    expect(b.meldung).toBe('Validation of the profile failed.');
  });

  it('findet Feldfehler in fieldErrors', () => {
    const b = leseFehler(
      400,
      JSON.stringify({
        code: 'validation-failure',
        fieldErrors: [{ fieldName: 'categoryId', code: 'category-not-found', message: 'The category does not exist.' }],
      }),
    );
    expect(b.felder).toHaveLength(1);
    expect(b.felder[0]).toMatchObject({ feld: 'categoryId', code: 'category-not-found' });
  });

  it('findet Feldfehler auch, wenn sie unter errors oder details haengen', () => {
    const unterErrors = leseFehler(400, JSON.stringify({ errors: [{ field: 'title', code: 'input-too-long', value: '60' }] }));
    expect(unterErrors.felder[0].feld).toBe('title');

    const unterDetails = leseFehler(400, JSON.stringify({ details: [{ name: 'postcode', errorCode: 'input-invalid' }] }));
    expect(unterDetails.felder[0].code).toBe('input-invalid');
  });

  it('macht aus einer HTML-Antwort keine leere Meldung', () => {
    const b = leseFehler(502, '<html><body>Bad Gateway</body></html>');
    expect(b.meldung).toContain('Bad Gateway');
    expect(b.felder).toEqual([]);
  });

  it('haelt eine leere Antwort aus', () => {
    const b = leseFehler(500, '');
    expect(b.meldung).toContain('500');
  });

  it('kuerzt lange Antworten, damit das Protokoll lesbar bleibt', () => {
    const b = leseFehler(500, 'x'.repeat(5000));
    expect(b.roh.length).toBeLessThanOrEqual(500);
  });
});

describe('fehlerText', () => {
  it('stellt die Feldfehler nach vorn ins Protokoll', () => {
    const b = leseFehler(
      400,
      JSON.stringify({
        code: 'validation-failure',
        fieldErrors: [{ fieldName: 'priceModel.askingPrice', code: 'input-too-short', message: 'too short' }],
      }),
    );
    const t = fehlerText(b);
    expect(t).toContain('validation-failure');
    expect(t).toContain('priceModel.askingPrice');
    expect(t).toContain('input-too-short');
  });
});

describe('titelGrenzeAus', () => {
  it('liest die erlaubte Laenge aus dem Feldfehler', () => {
    const b = leseFehler(
      400,
      JSON.stringify({ fieldErrors: [{ fieldName: 'title', code: 'input-too-long', value: '60' }] }),
    );
    expect(titelGrenzeAus(b)).toBe(60);
  });

  it('erkennt den Feldnamen auch mit Pfad davor', () => {
    const b = leseFehler(
      400,
      JSON.stringify({ fieldErrors: [{ fieldName: 'translations[0].title', code: 'input-too-long', value: '50 chars' }] }),
    );
    expect(titelGrenzeAus(b)).toBe(50);
  });

  it('gibt null zurueck, wenn es um ein anderes Feld oder einen anderen Fehler geht', () => {
    const anderesFeld = leseFehler(400, JSON.stringify({ fieldErrors: [{ fieldName: 'description', code: 'input-too-long', value: '80' }] }));
    expect(titelGrenzeAus(anderesFeld)).toBeNull();

    const andererCode = leseFehler(400, JSON.stringify({ fieldErrors: [{ fieldName: 'title', code: 'input-invalid', value: '60' }] }));
    expect(titelGrenzeAus(andererCode)).toBeNull();
  });
});

describe('istUnbekannteAnzeige', () => {
  it('erkennt 404 und den Fehlercode', () => {
    expect(istUnbekannteAnzeige(leseFehler(404, '{}'))).toBe(true);
    expect(istUnbekannteAnzeige(leseFehler(400, JSON.stringify({ code: 'advertisement-not-found' })))).toBe(true);
    expect(istUnbekannteAnzeige(leseFehler(400, JSON.stringify({ code: 'validation-failure' })))).toBe(false);
  });
});

describe('lohntWiederholung', () => {
  it('wiederholt bei Drosselung und Serverfehlern, nicht bei Pruefungsfehlern', () => {
    expect(lohntWiederholung(429)).toBe(true);
    expect(lohntWiederholung(503)).toBe(true);
    expect(lohntWiederholung(400)).toBe(false);
    expect(lohntWiederholung(401)).toBe(false);
  });
});
