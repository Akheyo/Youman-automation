import { describe, expect, it } from 'vitest';
import { fasseBestand } from './abgleich';

describe('fasseBestand', () => {
  it('zaehlt den Bestand derselben Variante ueber mehrere Lager zusammen', () => {
    const map = fasseBestand([
      { variationId: 5001, itemId: 65932, quantity: 2 },
      { variationId: 5001, itemId: 65932, quantity: 3 },
    ]);
    expect(map.get(5001)).toEqual({ itemId: 65932, bestand: 5 });
  });

  it('laesst einen Artikel nicht durch eine Nullzeile offline gehen', () => {
    // Bestand 4 in Lager A, 0 in Lager B. Ohne Zusammenfassen entschiede die
    // zuletzt gelesene Zeile — und der Artikel kaeme grundlos offline.
    const map = fasseBestand([
      { variationId: 7, quantity: 4 },
      { variationId: 7, quantity: 0 },
    ]);
    expect(map.get(7)!.bestand).toBe(4);
  });

  it('nimmt netStock vor quantity', () => {
    expect(fasseBestand([{ variationId: 1, netStock: 3, quantity: 9 }]).get(1)!.bestand).toBe(3);
  });

  it('ueberspringt Zeilen ohne brauchbare Varianten-ID', () => {
    const map = fasseBestand([{ quantity: 5 }, { variationId: 0, quantity: 5 }, { variationId: 2, quantity: 1 }]);
    expect([...map.keys()]).toEqual([2]);
  });

  it('behaelt die Artikel-ID aus der ersten Zeile, die eine hat', () => {
    const map = fasseBestand([
      { variationId: 3, quantity: 1 },
      { variationId: 3, itemId: 88, quantity: 1 },
    ]);
    expect(map.get(3)!.itemId).toBe(88);
  });

  it('macht aus einer leeren Seite eine leere Karte', () => {
    expect(fasseBestand([]).size).toBe(0);
  });
});
