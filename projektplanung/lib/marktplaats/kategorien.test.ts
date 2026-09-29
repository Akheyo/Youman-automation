import { describe, expect, it } from 'vitest';
import { findeKategorie, findeVorschlaege, flacheListe, normalisiere, type Kategorie, type Zuordnung } from './kategorien';

const baum = {
  categoryId: 0,
  _embedded: {
    'mp:category': [
      {
        categoryId: 1,
        name: 'Antiek en Kunst',
        labels: { 'nl-NL': 'Antiek en Kunst' },
        status: 'open',
        _embedded: {
          'mp:category': [
            { categoryId: 2, name: 'Antiek | Bestek', labels: { 'nl-NL': 'Antiek | Bestek' }, status: 'open' },
            { categoryId: 3, name: 'Antiek | Klokken', labels: { 'nl-NL': 'Antiek | Klokken' }, status: 'closed' },
          ],
        },
      },
      {
        categoryId: 10,
        name: 'Doe-het-zelf en Verbouw',
        status: 'open',
        _embedded: {
          'mp:category': [
            { categoryId: 11, name: 'Gereedschap | Boormachines', status: 'open' },
            { categoryId: 12, name: 'Gereedschap | Slijpmachines', status: 'open' },
          ],
        },
      },
    ],
  },
};

describe('flacheListe', () => {
  it('liefert nur die Blaetter, also die L2-Kategorien', () => {
    const liste = flacheListe(baum);
    expect(liste.map((k) => k.id).sort((a, b) => a - b)).toEqual([2, 3, 11, 12]);
  });

  it('haengt die Elternkategorie an jede Zeile', () => {
    const bestek = flacheListe(baum).find((k) => k.id === 2)!;
    expect(bestek.l1Id).toBe(1);
    expect(bestek.l1Name).toBe('Antiek en Kunst');
  });

  it('bevorzugt das nl-NL-Label vor dem name-Feld', () => {
    const liste = flacheListe({
      categoryId: 5,
      _embedded: { 'mp:category': [{ categoryId: 6, name: 'alt', labels: { 'nl-NL': 'neu' } }] },
    });
    expect(liste[0].name).toBe('neu');
  });

  it('merkt sich geschlossene Kategorien', () => {
    const klokken = flacheListe(baum).find((k) => k.id === 3)!;
    expect(klokken.offen).toBe(false);
  });

  it('haelt eine leere oder unerwartete Antwort aus', () => {
    expect(flacheListe(null)).toEqual([]);
    expect(flacheListe({})).toEqual([]);
    expect(flacheListe({ foo: 'bar' })).toEqual([]);
  });

  it('fuehrt dieselbe Kategorie nur einmal', () => {
    const doppelt = {
      _embedded: {
        a: [{ categoryId: 7, name: 'X' }],
        b: [{ categoryId: 7, name: 'X' }],
      },
    };
    expect(flacheListe(doppelt)).toHaveLength(1);
  });
});

describe('normalisiere', () => {
  it('raeumt Umlaute, Grossschreibung und Trennzeichen weg', () => {
    expect(normalisiere('Schleifmaschinen/Zubehör')).toBe('schleifmaschinen zubehor');
    expect(normalisiere('Gereedschap | Boormachines')).toBe('gereedschap boormachines');
    expect(normalisiere('Straße')).toBe('strasse');
  });
});

describe('findeVorschlaege', () => {
  const liste = flacheListe(baum);

  it('findet die Kategorie ueber ein gemeinsames Wort', () => {
    const v = findeVorschlaege('boormachines gebruikt', liste);
    expect(v[0].kategorie.id).toBe(11);
  });

  it('laesst geschlossene Kategorien weg', () => {
    const v = findeVorschlaege('klokken', liste);
    expect(v.find((x) => x.kategorie.id === 3)).toBeUndefined();
  });

  it('gibt nichts zurueck, wenn nichts passt', () => {
    expect(findeVorschlaege('hydraulikaggregat', liste)).toEqual([]);
  });

  it('gibt nichts zurueck bei leerem Begriff', () => {
    expect(findeVorschlaege('', liste)).toEqual([]);
    expect(findeVorschlaege('ab', liste)).toEqual([]);
  });
});

describe('findeKategorie', () => {
  const zuordnung = new Map<string, Zuordnung>([
    ['bohrmaschinen', { stichwort: 'bohrmaschinen', kategorieId: 11, kategorieName: 'Gereedschap | Boormachines' }],
    ['akkuschrauber', { stichwort: 'akkuschrauber', kategorieId: 11, kategorieName: 'Gereedschap | Boormachines' }],
  ]);

  it('nimmt zuerst die Plenty-Kategorie', () => {
    const t = findeKategorie(zuordnung, { plentyKategorie: 'Bohrmaschinen', artikelTyp: 'Akkuschrauber' });
    expect(t?.kategorieId).toBe(11);
    expect(t?.stichwort).toBe('bohrmaschinen');
  });

  it('faellt auf den Artikeltyp zurueck', () => {
    const t = findeKategorie(zuordnung, { plentyKategorie: 'Sonstiges', artikelTyp: 'Akkuschrauber' });
    expect(t?.stichwort).toBe('akkuschrauber');
  });

  it('gibt null zurueck statt irgendeiner Kategorie', () => {
    expect(findeKategorie(zuordnung, { plentyKategorie: 'Hydraulik', artikelTyp: 'Pumpe' })).toBeNull();
    expect(findeKategorie(zuordnung, {})).toBeNull();
  });
});
