import { describe, expect, it } from 'vitest';
import {
  aufZustandUmrechnen,
  feldBestimmen,
  gebrauchtAnteil,
  lohntListing,
  preisBestimmen,
  schoenerPreis,
  unterbietung,
} from './regelwerk';

describe('schoenerPreis', () => {
  it('trifft die von Amanuel genannten Beispiele', () => {
    expect(schoenerPreis(31)).toBe(29);
    expect(schoenerPreis(340)).toBe(339);
    expect(schoenerPreis(1240)).toBe(1239);
  });

  it('laesst 58,10 bei 58 — der Weg zur 49 waere zu teuer', () => {
    // Das Beispiel aus dem SOP. Ohne die Abschlagsgrenze wuerden hier neun
    // Euro fuer eine Ziffer verschenkt.
    expect(schoenerPreis(58.1)).toBe(58);
  });

  it('rundet nie nach oben', () => {
    // Sonst ueberholte der aufgerundete Preis den Wettbewerber wieder, den
    // wir gerade unterbieten wollten.
    for (const betrag of [29.9, 100.99, 45.5, 1239.99]) {
      expect(schoenerPreis(betrag)).toBeLessThanOrEqual(betrag);
    }
  });

  it('laesst eine vorhandene 9 stehen', () => {
    expect(schoenerPreis(29)).toBe(29);
    expect(schoenerPreis(199)).toBe(199);
  });

  it('kommt mit Kleinbetraegen und Unsinn klar', () => {
    expect(schoenerPreis(7.8)).toBe(7);
    expect(schoenerPreis(0)).toBe(0);
    expect(schoenerPreis(-5)).toBe(0);
    expect(schoenerPreis(Number.NaN)).toBe(0);
  });
});

describe('Zustandsumrechnung', () => {
  it('rechnet neu auf gebraucht', () => {
    // Ohne gravierende Schaeden 65 %.
    expect(aufZustandUmrechnen(150, 'neu', 'gebraucht')).toBeCloseTo(97.5);
  });

  it('zieht nur bei gravierenden Schaeden auf 60 % ab', () => {
    // Schmutz und normale Gebrauchsspuren kosten NICHTS — das war ausdruecklich wichtig.
    expect(gebrauchtAnteil({ gravierendeSchaeden: false })).toBeCloseTo(0.65);
    expect(gebrauchtAnteil({ gravierendeSchaeden: true })).toBeCloseTo(0.6);
    expect(aufZustandUmrechnen(150, 'neu', 'gebraucht', { gravierendeSchaeden: true })).toBeCloseTo(90);
  });

  it('rechnet gebraucht auf neu zurueck', () => {
    expect(aufZustandUmrechnen(97.5, 'gebraucht', 'neu')).toBeCloseTo(150);
  });

  it('rechnet neu auf defekt mit 30 Prozent', () => {
    expect(aufZustandUmrechnen(150, 'neu', 'defekt')).toBeCloseTo(45);
  });

  it('laesst gleiche Zustaende unveraendert', () => {
    expect(aufZustandUmrechnen(80, 'gebraucht', 'gebraucht')).toBe(80);
    expect(aufZustandUmrechnen(80, 'neu', 'neu_versiegelt')).toBe(80);
  });
});

describe('feldBestimmen', () => {
  it('wirft den einsamen Billiganbieter raus', () => {
    // Der Fall aus der Praxis: einer bei 20, sechs andere bei 50-70.
    const befund = feldBestimmen([
      { preis: 20, versand: 0, bestand: 1 },
      { preis: 50, versand: 0 },
      { preis: 55, versand: 0 },
      { preis: 60, versand: 0 },
      { preis: 70, versand: 0 },
    ]);
    expect(befund.ausreisser).toHaveLength(1);
    expect(befund.ausreisser[0].preis).toBe(20);
    expect(befund.referenz?.preis).toBe(50);
    expect(befund.begruendung[0]).toMatch(/Einzelstück/);
  });

  it('erkennt auch bei hochpreisiger Ware den Abstand', () => {
    // 400 gegen ein Feld bei 500 sind genau 20 Prozent.
    const befund = feldBestimmen([
      { preis: 400, versand: 0 },
      { preis: 500, versand: 0 },
      { preis: 510, versand: 0 },
      { preis: 520, versand: 0 },
    ]);
    expect(befund.referenz?.preis).toBe(500);
  });

  it('sortiert nach Preis PLUS Versand, nicht nach Preis', () => {
    // 45 + 9 = 54 ist teurer als 50 versandkostenfrei — genau so sortiert eBay.
    const befund = feldBestimmen([
      { preis: 45, versand: 9 },
      { preis: 50, versand: 0 },
      { preis: 52, versand: 0 },
    ]);
    expect(befund.referenz?.preis).toBe(50);
  });

  it('laesst bei wenigen Angeboten alles stehen', () => {
    // Mit zwei Angeboten gibt es kein Feld, gegen das man messen koennte.
    const befund = feldBestimmen([
      { preis: 20, versand: 0 },
      { preis: 70, versand: 0 },
    ]);
    expect(befund.ausreisser).toHaveLength(0);
    expect(befund.referenz?.preis).toBe(20);
  });

  it('meldet sich, wenn gar nichts da ist', () => {
    expect(feldBestimmen([]).referenz).toBeNull();
  });
});

describe('unterbietung', () => {
  it('staffelt nach Hoehe', () => {
    expect(unterbietung(30)).toBe(1);
    expect(unterbietung(120)).toBe(2);
    expect(unterbietung(400)).toBe(3);
    expect(unterbietung(900)).toBe(5);
  });
});

describe('preisBestimmen', () => {
  it('rechnet das Beispiel aus dem SOP nach', () => {
    // 60 € + 6 € Versand = 66, minus unser Versand 7,90.
    // Das SOP kommt ohne Unterbietung auf 58; mit 2 € Staffel auf 56.
    const ergebnis = preisBestimmen({
      angebote: [{ preis: 60, versand: 6, quelle: 'eBay' }],
      unserVersand: 7.9,
    });
    expect(ergebnis.ebay).toBe(56);
    expect(ergebnis.webshop).toBe(53);
    expect(ergebnis.begruendung.join(' ')).toMatch(/66\.00 € gesamt/);
  });

  it('unterbietet die Summe, nicht den Artikelpreis', () => {
    const ergebnis = preisBestimmen({
      angebote: [
        { preis: 45, versand: 9 },
        { preis: 50, versand: 0 },
        { preis: 52, versand: 0 },
      ],
      unserVersand: 5,
    });
    // Referenz ist 50 + 0 = 50 gesamt, minus 1 € Unterbietung, minus 5 € Versand = 44.
    // Bei 44 bleibt es: der Weg zur 39 waere ein Abschlag von 5 € fuer eine
    // Ziffer, und das verhindert MAX_RUNDUNGS_ABSCHLAG.
    expect(ergebnis.referenz?.preis).toBe(50);
    expect(ergebnis.ebay).toBe(44);
  });

  it('sagt es, wenn der eigene Versand den Preis auffrisst', () => {
    // 40-kg-Teil: Wettbewerber bietet 30 € versandkostenfrei, wir haben 35 € Fracht.
    const ergebnis = preisBestimmen({
      angebote: [{ preis: 30, versand: 0 }],
      unserVersand: 35,
    });
    expect(ergebnis.versandFrisstPreis).toBe(true);
    expect(ergebnis.ebay).toBeNull();
    expect(ergebnis.begruendung.join(' ')).toMatch(/nicht zu gewinnen/);
  });

  it('erfindet ohne Angebot keinen Preis', () => {
    const ergebnis = preisBestimmen({ angebote: [], unserVersand: 5 });
    expect(ergebnis.ebay).toBeNull();
    expect(ergebnis.versandFrisstPreis).toBe(false);
  });

  it('haelt den Webshop unter dem eBay-Preis', () => {
    const ergebnis = preisBestimmen({ angebote: [{ preis: 200, versand: 0 }], unserVersand: 6 });
    expect(ergebnis.webshop!).toBeLessThan(ergebnis.ebay!);
  });

  it('begruendet jeden Preis nachvollziehbar', () => {
    // Ein Preis ohne Herleitung wird nicht kontrolliert, sondern geglaubt.
    const ergebnis = preisBestimmen({ angebote: [{ preis: 60, versand: 6 }], unserVersand: 7.9 });
    expect(ergebnis.begruendung.length).toBeGreaterThanOrEqual(3);
  });
});

describe('lohntListing', () => {
  it('rechnet mit dem Gesamtwert, nicht mit dem Stueckpreis', () => {
    // Ein Listing kostet dieselbe Arbeit, ob eins oder zehn Stueck drin liegen.
    expect(lohntListing(10, 10).lohntSich).toBe(true);
    expect(lohntListing(10, 1).lohntSich).toBe(false);
  });

  it('haelt die Grenze bei 13 Euro', () => {
    expect(lohntListing(13, 1).lohntSich).toBe(true);
    expect(lohntListing(12.99, 1).lohntSich).toBe(false);
  });

  it('entscheidet ohne Preis gar nicht', () => {
    expect(lohntListing(null, 5).lohntSich).toBe(false);
    expect(lohntListing(null, 5).begruendung).toMatch(/Ohne Preis/);
  });
});
