import { describe, it, expect } from 'vitest';
import { formatEuro, formatProzent, parseGermanNumber } from './format';

describe('formatEuro', () => {
  it('formatiert 1533 als 1.533,00 €', () => {
    //   ist non-breaking space, den Intl benutzt
    expect(formatEuro(1533).replace(/ /g, ' ')).toBe('1.533,00 €');
  });
  it('zeigt — für null/undefined', () => {
    expect(formatEuro(null)).toBe('—');
    expect(formatEuro(undefined)).toBe('—');
  });
});

describe('formatProzent', () => {
  it('formatiert 32.27 als 32,27 %', () => {
    expect(formatProzent(32.27).replace(/ /g, ' ')).toBe('32,27 %');
  });
});

describe('parseGermanNumber', () => {
  it('parst deutsches Format mit Tausender und Komma', () => {
    expect(parseGermanNumber('1.533,50')).toBe(1533.5);
  });
  it('parst Komma als Dezimal', () => {
    expect(parseGermanNumber('1533,50')).toBe(1533.5);
  });
  it('parst pure Zahlen', () => {
    expect(parseGermanNumber('1533')).toBe(1533);
    expect(parseGermanNumber('1533.50')).toBe(1533.5);
  });
  it('strippt €-Zeichen und Whitespace', () => {
    expect(parseGermanNumber(' 1.533,50 € ')).toBe(1533.5);
  });
  it('liefert null bei leerem String', () => {
    expect(parseGermanNumber('')).toBeNull();
    expect(parseGermanNumber('abc')).toBeNull();
  });
});
