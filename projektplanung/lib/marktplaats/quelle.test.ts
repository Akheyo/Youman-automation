import { describe, expect, it } from 'vitest';
import { bildUrls, eintraege, findePreis, leseTexte, leseVariante } from './quelle';

describe('eintraege', () => {
  it('nimmt beide Formen, die Plenty liefert', () => {
    expect(eintraege([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(eintraege({ entries: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(eintraege(null)).toEqual([]);
    expect(eintraege({})).toEqual([]);
  });
});

describe('findePreis', () => {
  const zeilen = [
    { salesPriceId: 1, price: 49 },
    { salesPriceId: 2, price: 46.55 },
  ];

  it('nimmt die erste Preisliste der Reihenfolge', () => {
    expect(findePreis(zeilen, [2, 1])).toBe(46.55);
    expect(findePreis(zeilen, [1, 2])).toBe(49);
  });

  it('faellt auf die zweite zurueck, wenn die erste fehlt', () => {
    expect(findePreis(zeilen, [99, 1])).toBe(49);
  });

  it('nimmt notfalls irgendeinen Preis ueber null', () => {
    expect(findePreis(zeilen, [99, 98])).toBe(49);
  });

  it('ignoriert Preiszeilen mit 0 und liefert null, wenn es keinen Preis gibt', () => {
    expect(findePreis([{ salesPriceId: 1, price: 0 }], [1])).toBeNull();
    expect(findePreis([], [1, 2])).toBeNull();
  });

  it('ueberspringt leere IDs in der Reihenfolge', () => {
    expect(findePreis(zeilen, [null, 2])).toBe(46.55);
  });
});

describe('bildUrls', () => {
  it('sortiert nach Position und nimmt die groesste Fassung', () => {
    const urls = bildUrls([
      { position: 2, url: 'https://x/2.jpg', urlPreview: 'https://x/2-klein.jpg' },
      { position: 1, url: 'https://x/1.jpg' },
    ]);
    expect(urls).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
  });

  it('faellt auf kleinere Fassungen zurueck, wenn die grosse fehlt', () => {
    expect(bildUrls([{ position: 1, urlMiddle: 'https://x/m.jpg' }])).toEqual(['https://x/m.jpg']);
  });

  it('laesst GIF weg, weil Marktplaats es nicht annimmt', () => {
    expect(bildUrls([{ position: 1, url: 'https://x/a.gif' }, { position: 2, url: 'https://x/b.jpg' }])).toEqual([
      'https://x/b.jpg',
    ]);
  });

  it('laesst relative und leere Adressen weg', () => {
    expect(bildUrls([{ position: 1, url: '/bilder/a.jpg' }, { position: 2, url: '' }])).toEqual([]);
  });
});

describe('leseTexte', () => {
  it('nimmt name1 als Titel und die Langbeschreibung als Text', () => {
    const t = leseTexte([{ name1: 'Bohrhammer', description: 'Langer Text', shortDescription: 'kurz' }]);
    expect(t).toEqual({ titel: 'Bohrhammer', beschreibung: 'Langer Text' });
  });

  it('faellt auf die Kurzbeschreibung zurueck', () => {
    expect(leseTexte([{ name1: 'X', shortDescription: 'kurz' }]).beschreibung).toBe('kurz');
  });

  it('liefert null statt leerer Zeichenketten', () => {
    expect(leseTexte([{ name1: '   ', description: '' }])).toEqual({ titel: null, beschreibung: null });
    expect(leseTexte([])).toEqual({ titel: null, beschreibung: null });
  });
});

describe('leseVariante', () => {
  const roh = {
    id: 5001,
    itemId: 65932,
    number: 'KK-2024-0815',
    name: 'Bohrhammer GBH 2-26',
    model: 'GBH 2-26 DFR',
    variationSalesPrices: [{ salesPriceId: 2, price: 89.9 }],
    variationBarcodes: [{ code: '2012345678903' }],
  };

  it('liest den Kern einer Variante', () => {
    expect(leseVariante(roh, { preisReihenfolge: [2, 1] })).toEqual({
      variationId: 5001,
      itemId: 65932,
      nummer: 'KK-2024-0815',
      titel: 'Bohrhammer GBH 2-26',
      mpn: 'GBH 2-26 DFR',
      ean: '2012345678903',
      preisEuro: 89.9,
    });
  });

  it('kommt mit der alten Schreibweise salesPrices/barcodes zurecht', () => {
    const alt = {
      id: 5001,
      itemId: 65932,
      salesPrices: [{ salesPriceId: 2, price: 12 }],
      barcodes: [{ code: '4001' }],
    };
    const gelesen = leseVariante(alt, { preisReihenfolge: [2] });
    expect(gelesen.preisEuro).toBe(12);
    expect(gelesen.ean).toBe('4001');
  });

  it('holt die Artikel-ID aus dem eingebetteten item, wenn sie oben fehlt', () => {
    const gelesen = leseVariante({ id: 1, item: { id: 42 } }, { preisReihenfolge: [] });
    expect(gelesen.itemId).toBe(42);
  });

  it('macht aus fehlenden Feldern null statt undefined', () => {
    const gelesen = leseVariante({ id: 1 }, { preisReihenfolge: [] });
    expect(gelesen.mpn).toBeNull();
    expect(gelesen.ean).toBeNull();
    expect(gelesen.preisEuro).toBeNull();
    expect(gelesen.titel).toBe('');
  });
});
