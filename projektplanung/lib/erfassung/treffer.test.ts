import { describe, expect, it } from 'vitest';
import { suchbegriffeOrdnen } from './treffer';

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
