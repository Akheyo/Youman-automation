import { describe, expect, it } from 'vitest';
import { ean13CheckDigit, generateEan13, isValidEan13 } from './ean';

describe('ean13CheckDigit', () => {
  it('berechnet bekannte Prüfziffern korrekt', () => {
    // 400638133393 → Prüfziffer 1 (gängiges Testbeispiel)
    expect(ean13CheckDigit('400638133393')).toBe(1);
    // 978014300723 → Prüfziffer 4
    expect(ean13CheckDigit('978014300723')).toBe(4);
  });

  it('wirft bei falscher Länge', () => {
    expect(() => ean13CheckDigit('123')).toThrow();
    expect(() => ean13CheckDigit('12345678901a')).toThrow();
  });
});

describe('generateEan13', () => {
  it('erzeugt 13 Ziffern mit gültiger Prüfziffer', () => {
    const code = generateEan13(1_723_456_789_000);
    expect(code).toMatch(/^\d{13}$/);
    expect(isValidEan13(code)).toBe(true);
  });

  it('respektiert den Präfix', () => {
    expect(generateEan13(12345, '20').startsWith('20')).toBe(true);
    expect(generateEan13(12345, '29').startsWith('29')).toBe(true);
  });

  it('ist deterministisch für denselben Seed', () => {
    expect(generateEan13(42, '20')).toBe(generateEan13(42, '20'));
  });

  it('funktioniert auch mit String-Seeds', () => {
    const code = generateEan13('projekt-bosch-esslingen', '20');
    expect(isValidEan13(code)).toBe(true);
  });
});

describe('isValidEan13', () => {
  it('erkennt ungültige Codes', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333930')).toBe(false); // falsche Prüfziffer
    expect(isValidEan13('123')).toBe(false);
  });
});
