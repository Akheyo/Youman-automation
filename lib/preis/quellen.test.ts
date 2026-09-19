import { describe, expect, it } from 'vitest';
import { stufenGuete, waehleQuellen, type MarktAngebot } from './quellen';

function a(teil: Partial<MarktAngebot>): MarktAngebot {
  return { preis: 50, versand: 0, land: 'DE', plattform: 'ebay', ...teil };
}

describe('waehleQuellen', () => {
  it('nimmt deutsche eBay-Angebote, wenn es sie gibt', () => {
    const wahl = waehleQuellen([
      a({ land: 'DE', plattform: 'ebay', preis: 50 }),
      a({ land: 'DE', plattform: 'netz', preis: 40 }),
      a({ land: 'AT', plattform: 'ebay', preis: 30 }),
    ]);
    expect(wahl.stufe).toBe('ebay_de');
    expect(wahl.angebote).toHaveLength(1);
    expect(wahl.angebote[0].preis).toBe(50);
  });

  it('geht ins freie Netz, wenn eBay nichts Deutsches hat', () => {
    const wahl = waehleQuellen([
      a({ land: 'DE', plattform: 'netz', preis: 40 }),
      a({ land: 'AT', plattform: 'ebay', preis: 30 }),
    ]);
    expect(wahl.stufe).toBe('netz_de');
  });

  it('geht erst dann in die Nachbarlaender', () => {
    const wahl = waehleQuellen([
      a({ land: 'AT', plattform: 'netz', preis: 30 }),
      a({ land: 'PL', plattform: 'ebay', preis: 20 }),
    ]);
    expect(wahl.stufe).toBe('nachbarn_dach');
    expect(wahl.angebote[0].land).toBe('AT');
  });

  it('nimmt die uebrigen Nachbarn, wenn AT und CH nichts haben', () => {
    const wahl = waehleQuellen([a({ land: 'PL', plattform: 'netz', preis: 20 })]);
    expect(wahl.stufe).toBe('nachbarn_uebrige');
  });

  it('nimmt Entferntes nur als Notnagel', () => {
    const wahl = waehleQuellen([a({ land: 'US', plattform: 'netz', preis: 20 })]);
    expect(wahl.stufe).toBe('weiter_weg');
    expect(stufenGuete(wahl.stufe)).toBe('niedrig');
  });

  it('mischt die Stufen NICHT', () => {
    // Deutsche eBay-Preise und Schweizer Shoppreise in einen Topf zu werfen
    // erzeugt einen Durchschnitt, den es auf keinem Markt gibt.
    const wahl = waehleQuellen([
      a({ land: 'DE', plattform: 'ebay', preis: 50 }),
      a({ land: 'CH', plattform: 'netz', preis: 80 }),
    ]);
    expect(wahl.angebote.every((x) => x.land === 'DE')).toBe(true);
  });

  it('weist auf umgerechnete Waehrungen hin', () => {
    const wahl = waehleQuellen([a({ land: 'CH', plattform: 'netz', preis: 85, originalWaehrung: 'CHF' })]);
    expect(wahl.umgerechnet).toHaveLength(1);
    expect(wahl.begruendung.join(' ')).toMatch(/Fremdwährung/);
    expect(wahl.begruendung.join(' ')).toMatch(/Mehrwertsteuer/);
  });

  it('haelt fest, wo nichts zu holen war', () => {
    const wahl = waehleQuellen([a({ land: 'PL', plattform: 'netz' })]);
    expect(wahl.begruendung[0]).toMatch(/eBay.de.*nichts gefunden/);
  });

  it('kommt mit gar nichts klar', () => {
    const wahl = waehleQuellen([]);
    expect(wahl.stufe).toBeNull();
    expect(wahl.angebote).toHaveLength(0);
  });

  it('ignoriert Angebote ohne Preis', () => {
    const wahl = waehleQuellen([a({ preis: 0 }), a({ land: 'AT', preis: 30, plattform: 'netz' })]);
    expect(wahl.stufe).toBe('nachbarn_dach');
  });
});

describe('stufenGuete', () => {
  it('sagt, wie weit man fuer den Preis gehen musste', () => {
    expect(stufenGuete('ebay_de')).toBe('hoch');
    expect(stufenGuete('netz_de')).toBe('mittel');
    expect(stufenGuete('nachbarn_dach')).toBe('mittel');
    expect(stufenGuete('nachbarn_uebrige')).toBe('niedrig');
    expect(stufenGuete(null)).toBe('niedrig');
  });
});
