import { describe, expect, it } from 'vitest';
import { entscheide, leereBilanz, schreibt, zaehle, type Lage } from './entscheidung';

const online: Lage = {
  bestand: 3,
  bereit: true,
  gesperrt: false,
  fingerabdruck: 'A',
  itemId: 'm1372',
  bekannterFingerabdruck: 'A',
};

const neu: Lage = { ...online, itemId: null, bekannterFingerabdruck: null };

describe('entscheide', () => {
  it('legt einen neuen Artikel mit Bestand an', () => {
    expect(entscheide(neu).massnahme).toBe('anlegen');
  });

  it('laesst eine unveraenderte Anzeige in Ruhe', () => {
    expect(entscheide(online).massnahme).toBe('nichts');
  });

  it('aendert, wenn sich der Inhalt geaendert hat', () => {
    expect(entscheide({ ...online, fingerabdruck: 'B' }).massnahme).toBe('aendern');
  });

  it('nimmt eine Anzeige ohne Bestand offline', () => {
    expect(entscheide({ ...online, bestand: 0 }).massnahme).toBe('loeschen');
  });

  it('tut nichts bei einem Artikel ohne Bestand und ohne Anzeige', () => {
    expect(entscheide({ ...neu, bestand: 0 }).massnahme).toBe('nichts');
  });

  it('nimmt einen gesperrten Artikel offline, auch wenn Bestand da ist', () => {
    const e = entscheide({ ...online, gesperrt: true });
    expect(e.massnahme).toBe('loeschen');
    expect(e.grund).toMatch(/Markenregel/);
  });

  it('veroeffentlicht einen gesperrten Artikel gar nicht erst', () => {
    expect(entscheide({ ...neu, gesperrt: true }).massnahme).toBe('wartet');
  });

  it('sperrt vor Bestand: gesperrt und ohne Bestand wird geloescht, nicht uebersprungen', () => {
    expect(entscheide({ ...online, gesperrt: true, bestand: 0 }).massnahme).toBe('loeschen');
  });

  it('laesst eine laufende Anzeige stehen, wenn voruebergehend Angaben fehlen', () => {
    // Genau der Fall, der ein ganzes Sortiment abraeumen wuerde: In Plenty
    // wird eine Preisliste umgestellt, fuer eine Stunde fehlt der Preis.
    const e = entscheide({ ...online, bereit: false, fingerabdruck: null });
    expect(e.massnahme).toBe('nichts');
    expect(e.grund).toMatch(/bleibt/);
  });

  it('veroeffentlicht einen unvollstaendigen Artikel nicht', () => {
    expect(entscheide({ ...neu, bereit: false, fingerabdruck: null }).massnahme).toBe('wartet');
  });

  it('behandelt negativen Bestand wie keinen Bestand', () => {
    expect(entscheide({ ...online, bestand: -1 }).massnahme).toBe('loeschen');
  });
});

describe('Bilanz', () => {
  it('zaehlt jede Massnahme auf ihr Feld', () => {
    const b = leereBilanz();
    zaehle(b, 'anlegen');
    zaehle(b, 'anlegen');
    zaehle(b, 'aendern');
    zaehle(b, 'loeschen');
    zaehle(b, 'nichts');
    zaehle(b, 'wartet');
    expect(b).toEqual({ angelegt: 2, geaendert: 1, geloescht: 1, unveraendert: 1, wartet: 1, fehler: 0 });
  });
});

describe('schreibt', () => {
  it('kennt genau die Massnahmen, die ein Probelauf zurueckhaelt', () => {
    expect(schreibt('anlegen')).toBe(true);
    expect(schreibt('aendern')).toBe(true);
    expect(schreibt('loeschen')).toBe(true);
    expect(schreibt('nichts')).toBe(false);
    expect(schreibt('wartet')).toBe(false);
  });
});
