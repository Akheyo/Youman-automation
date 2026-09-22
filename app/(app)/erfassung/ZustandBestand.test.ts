import { describe, expect, it } from 'vitest';
import { leseGewicht } from './ZustandBestand';

describe('leseGewicht', () => {
  it('nimmt das deutsche Komma', () => {
    // Genau hier ging es schief: type="number" verwarf "2,5" still, und der
    // Artikel lief ohne Gewicht weiter, obwohl Ziffern im Feld standen.
    expect(leseGewicht('2,5')).toBe(2.5);
  });

  it('nimmt auch den Punkt', () => {
    expect(leseGewicht('2.5')).toBe(2.5);
  });

  it('nimmt ganze Zahlen', () => {
    expect(leseGewicht('12')).toBe(12);
  });

  it('macht aus Unfertigem nichts', () => {
    expect(leseGewicht('')).toBeNull();
    expect(leseGewicht(',')).toBeNull();
    expect(leseGewicht('0')).toBeNull();
    expect(leseGewicht('-3')).toBeNull();
  });

  it('rundet auf Gramm', () => {
    expect(leseGewicht('2,4567')).toBe(2.457);
  });

  it('deckelt Zahlendreher', () => {
    expect(leseGewicht('2500')).toBe(300);
  });
});
