import { describe, expect, it } from 'vitest';
import { alsTreffer, suchbegriffeOrdnen, trefferSchluessel, trefferText } from './treffer-kern';

const basis = { modellnummer: null, hersteller: null, modell: null, titel: '', suchbegriffe: [] as string[] };

describe('suchbegriffeOrdnen', () => {
  it('stellt die Modellnummer nach vorn', () => {
    const begriffe = suchbegriffeOrdnen({
      ...basis,
      modellnummer: '06019H5200',
      hersteller: 'Bosch',
      modell: 'GSR 18V-55',
      titel: 'Bosch GSR 18V-55 Akkuschrauber',
    });
    expect(begriffe[0]).toBe('06019H5200');
    expect(begriffe[1]).toBe('Bosch GSR 18V-55');
  });

  it('wirft zu allgemeine Einzelwoerter weg', () => {
    // "Kabel" traefe das halbe Lager — ein solcher Treffer waere wertlos.
    expect(suchbegriffeOrdnen({ ...basis, titel: 'Kabel', suchbegriffe: ['Kabel', 'grau'] })).toEqual([]);
  });

  it('laesst kurze Begriffe mit Ziffern durch, weil das Modellnummern sind', () => {
    expect(suchbegriffeOrdnen({ ...basis, suchbegriffe: ['GSR18V'] })).toEqual(['GSR18V']);
  });

  it('nennt denselben Begriff nicht zweimal', () => {
    const begriffe = suchbegriffeOrdnen({
      ...basis,
      titel: 'Bosch GSR 18V-55',
      suchbegriffe: ['bosch gsr 18v-55', 'Bosch GSR 18V-55'],
    });
    expect(begriffe).toEqual(['Bosch GSR 18V-55']);
  });

  it('deckelt die Anzahl, damit die Suche nicht ausufert', () => {
    const begriffe = suchbegriffeOrdnen({
      ...basis,
      suchbegriffe: ['Erster Begriff', 'Zweiter Begriff', 'Dritter Begriff', 'Vierter Begriff', 'Fuenfter Begriff'],
    });
    expect(begriffe).toHaveLength(4);
  });

  it('kommt mit einer voellig leeren Erkennung klar', () => {
    expect(suchbegriffeOrdnen(basis)).toEqual([]);
  });
});

describe('alsTreffer', () => {
  it('nimmt die Artikel-ID aus itemId', () => {
    const [t] = alsTreffer([{ id: 991, itemId: 65932, name: 'Bohrmaschine', number: 'KK-1' }], 'Bohrmaschine');
    expect(t.itemId).toBe(65932);
    expect(t.variationId).toBe(991);
  });

  it('holt die Artikel-ID notfalls aus dem eingebetteten item', () => {
    const [t] = alsTreffer([{ id: 991, item: { id: 65932 } }], 'x');
    expect(t.itemId).toBe(65932);
  });

  it('kommt mit Zahlen als Text klar', () => {
    const [t] = alsTreffer([{ id: '991', itemId: '65932' }], 'x');
    expect(t.itemId).toBe(65932);
  });
});

describe('trefferSchluessel', () => {
  it('fasst mehrere Varianten desselben Artikels zusammen', () => {
    // Ein Artikel mit drei Varianten ist EIN Treffer, nicht drei.
    const eintraege = alsTreffer(
      [
        { id: 1, itemId: 65932 },
        { id: 2, itemId: 65932 },
        { id: 3, itemId: 70001 },
      ],
      'x',
    );
    const schluessel = new Set(eintraege.map(trefferSchluessel));
    expect(schluessel.size).toBe(2);
  });

  it('haelt Treffer ohne Artikel-ID trotzdem auseinander', () => {
    const eintraege = alsTreffer([{ id: 1 }, { id: 2 }], 'x');
    expect(new Set(eintraege.map(trefferSchluessel)).size).toBe(2);
  });
});

describe('trefferText', () => {
  it('stellt die Artikel-ID voran', () => {
    expect(trefferText({ itemId: 65932, variationId: 991, name: 'Bohrmaschine', nummer: null, gefundenMit: 'x' })).toBe(
      'Artikel 65932 — Bohrmaschine',
    );
  });

  it('kommt ohne Bezeichnung aus', () => {
    expect(trefferText({ itemId: 65932, variationId: 991, name: null, nummer: null, gefundenMit: 'x' })).toBe(
      'Artikel 65932',
    );
  });

  it('zeigt NIE eine Variantennummer an Stelle der Artikel-ID', () => {
    // Sonst haelt jemand die Variante fuer die Artikel-ID und sucht in Plenty
    // nach einer Nummer, die es dort so nicht gibt.
    const text = trefferText({ itemId: null, variationId: 991, name: 'Bohrmaschine', nummer: 'KK-1', gefundenMit: 'x' });
    expect(text).toBe('Bohrmaschine (ohne Artikel-ID)');
    expect(text).not.toContain('991');
  });
});
