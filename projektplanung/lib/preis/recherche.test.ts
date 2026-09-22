import { describe, expect, it } from 'vitest';
import { alsMarktangebot, brauchbar, type GefundenesAngebot } from './recherche';

function angebot(teil: Partial<GefundenesAngebot> = {}): GefundenesAngebot {
  return {
    preis: 60,
    versand: 6,
    versandUnbekannt: false,
    land: 'DE',
    plattform: 'ebay',
    originalWaehrung: null,
    zustand: 'gebraucht',
    bestand: 1,
    titel: 'Bosch GSR 18V-55',
    url: 'https://www.ebay.de/itm/123',
    passgenauigkeit: 'exakt',
    ...teil,
  };
}

describe('brauchbar', () => {
  it('nimmt ein vollstaendiges Angebot', () => {
    expect(brauchbar(angebot())).toBe(true);
  });

  it('wirft Angebote mit unbekanntem Versand raus', () => {
    // eBay sortiert nach Preis plus Versand — ein mit 0 angesetzter
    // Fremdversand laesst uns zu billig einsortieren.
    expect(brauchbar(angebot({ versandUnbekannt: true }))).toBe(false);
  });

  it('wirft Angebote ohne Adresse raus', () => {
    expect(brauchbar(angebot({ url: '' }))).toBe(false);
    expect(brauchbar(angebot({ url: 'ebay.de/itm/123' }))).toBe(false);
  });

  it('wirft Angebote ohne Preis raus', () => {
    expect(brauchbar(angebot({ preis: 0 }))).toBe(false);
    expect(brauchbar(angebot({ preis: Number.NaN }))).toBe(false);
  });

  it('wirft nur aehnliche Artikel raus', () => {
    expect(brauchbar(angebot({ passgenauigkeit: 'aehnlich' }))).toBe(false);
    expect(brauchbar(angebot({ passgenauigkeit: 'baureihe' }))).toBe(true);
  });

  it('wirft Angebote ohne Land raus', () => {
    expect(brauchbar(angebot({ land: '' }))).toBe(false);
  });
});

describe('alsMarktangebot', () => {
  it('uebernimmt einen gebrauchten Preis unveraendert', () => {
    const m = alsMarktangebot(angebot({ preis: 60, zustand: 'gebraucht' }), 'gebraucht', false);
    expect(m?.preis).toBe(60);
  });

  it('rechnet einen Neupreis auf unseren gebrauchten Artikel herunter', () => {
    const m = alsMarktangebot(angebot({ preis: 100, zustand: 'neu' }), 'gebraucht', false);
    expect(m?.preis).toBeLessThan(100);
    expect(m?.preis).toBeGreaterThan(50);
  });

  it('rechnet mit gravierenden Schaeden weiter herunter', () => {
    const ohne = alsMarktangebot(angebot({ preis: 100, zustand: 'neu' }), 'gebraucht', false);
    const mit = alsMarktangebot(angebot({ preis: 100, zustand: 'neu' }), 'gebraucht', true);
    expect(mit!.preis).toBeLessThan(ohne!.preis);
  });

  it('verwirft ein Angebot mit unbekanntem Zustand', () => {
    // „Unbekannt" als „gebraucht" durchzuwinken laege bei einem Neuangebot
    // um 35 bis 40 Prozent daneben.
    expect(alsMarktangebot(angebot({ zustand: 'unbekannt' }), 'gebraucht', false)).toBeNull();
  });

  it('haelt Land und Plattform fest', () => {
    const m = alsMarktangebot(angebot({ land: 'at', plattform: 'netz' }), 'gebraucht', false);
    expect(m?.land).toBe('AT');
    expect(m?.plattform).toBe('netz');
  });

  it('merkt sich die Adresse als Quelle', () => {
    const m = alsMarktangebot(angebot(), 'gebraucht', false);
    expect(m?.quelle).toBe('https://www.ebay.de/itm/123');
  });

  it('reicht den Versand unveraendert durch', () => {
    const m = alsMarktangebot(angebot({ versand: 7.9 }), 'gebraucht', false);
    expect(m?.versand).toBe(7.9);
  });

  it('merkt sich die Fremdwaehrung', () => {
    const m = alsMarktangebot(angebot({ land: 'CH', originalWaehrung: 'CHF' }), 'gebraucht', false);
    expect(m?.originalWaehrung).toBe('CHF');
  });
});
