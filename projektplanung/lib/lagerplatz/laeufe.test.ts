/**
 * Testet den Leser der Anlege-Tabelle. Die Vorlage ist die Tabelle, die auch
 * die Browser-Erweiterung abgearbeitet hat — sie muss sich unverändert
 * einfügen lassen, mit laufender Nummer und mit Spalten aus Leerzeichen.
 */
import { describe, expect, it } from 'vitest';

import { anzahlAus, codesAus, codesAusTabelle, leseLauf, leseLaeufe } from './laeufe';

/** So kam die Tabelle aus der Auswertung — inklusive Kopfzeile. */
const TABELLE = `Nr  Halle Regal Ebene Feld       Lagerort
21   3     4     A     2        K 1-36
23   2     7     A     7-9      0
43   1     7     A     16-17    K 1-48
100  6     4     D     1        0`;

describe('leseLauf', () => {
  it('liest eine Zeile mit laufender Nummer und Kisten', () => {
    const res = leseLauf('21   3     4     A     2        K 1-36');
    expect(res).toEqual({
      lauf: { halle: 3, regal: '4', ebene: 'A', vonFach: 2, bisFach: 2, praefix: 'K', vonOrt: 1, bisOrt: 36 },
    });
  });

  it('liest einen Feldbereich ohne Kisten', () => {
    const res = leseLauf('23   2     7     A     7-9      0');
    expect(res).toMatchObject({ lauf: { vonFach: 7, bisFach: 9, praefix: '', vonOrt: 0, bisOrt: 0 } });
  });

  it('liest auch die Schreibweise mit senkrechten Strichen', () => {
    expect(leseLauf('3|4|A|2|K 1-36')).toMatchObject({ lauf: { halle: 3, regal: '4', bisOrt: 36 } });
  });

  it('liest Präfixe an den Werten mit ("H3 R4 EA F2")', () => {
    expect(leseLauf('H3 R4 EA F2 K1-36')).toMatchObject({
      lauf: { halle: 3, regal: '4', ebene: 'A', vonFach: 2, praefix: 'K', bisOrt: 36 },
    });
  });

  it('liest ein Kleinteillager-Regal', () => {
    expect(leseLauf('1 | 5KTL | A | 15 | 0')).toMatchObject({ lauf: { regal: '5KTL' } });
  });

  it('liest die Ebene E, statt sie für ein Präfix zu halten', () => {
    // Fiel bei der echten Tabelle auf: vier Läufe auf Ebene E wären
    // stillschweigend verschwunden, weil das "E" als Präfix abgeschnitten wurde.
    expect(leseLauf('53   1     8     E     17-18    0')).toMatchObject({
      lauf: { halle: 1, regal: '8', ebene: 'E', vonFach: 17, bisFach: 18 },
    });
    expect(leseLauf('81   1     4     EE    11       K 1-36')).toMatchObject({ lauf: { ebene: 'E' } });
  });

  it('überspringt Kopfzeile und Leerzeilen', () => {
    expect(leseLauf('Nr  Halle Regal Ebene Feld       Lagerort')).toBeNull();
    expect(leseLauf('   ')).toBeNull();
  });

  it('meldet eine unlesbare Ebene, statt zu raten', () => {
    const res = leseLauf('1 | 7 | X | 3 | 0');
    expect(res).toMatchObject({ fehler: expect.stringContaining('Ebene') });
  });

  it('meldet eine Zeile mit zu wenig Spalten', () => {
    expect(leseLauf('1 | 7 | A')).toMatchObject({ fehler: expect.stringContaining('fünf Spalten') });
  });

  it('meldet einen rückwärts laufenden Bereich', () => {
    expect(leseLauf('1 | 7 | A | 9-3 | 0')).toMatchObject({ fehler: expect.stringContaining('Feld') });
  });
});

describe('codesAus', () => {
  it('erzeugt Kisten in der Plenty-Schreibweise', () => {
    const lauf = leseLauf('21   3     4     A     2        K 1-36');
    const codes = codesAus((lauf as { lauf: Parameters<typeof codesAus>[0] }).lauf);
    expect(codes).toHaveLength(36);
    expect(codes[0]).toBe('H3/R4/EA F02-K01');
    expect(codes[35]).toBe('H3/R4/EA F02-K36');
  });

  it('erzeugt den reinen Stellplatz ohne Kisten', () => {
    const lauf = leseLauf('23   2     7     A     7-9      0');
    const codes = codesAus((lauf as { lauf: Parameters<typeof codesAus>[0] }).lauf);
    expect(codes).toEqual(['H2/R7/EA F07-0', 'H2/R7/EA F08-0', 'H2/R7/EA F09-0']);
  });

  it('multipliziert Felder mit Kisten', () => {
    const lauf = leseLauf('43   1     7     A     16-17    K 1-48');
    const l = (lauf as { lauf: Parameters<typeof codesAus>[0] }).lauf;
    expect(anzahlAus(l)).toBe(96);
    expect(codesAus(l)).toHaveLength(96);
  });
});

describe('codesAusTabelle', () => {
  it('liest die Tabelle aus der Auswertung unverändert', () => {
    const res = codesAusTabelle(TABELLE);
    expect(res.fehler).toEqual([]);
    expect(res.laeufe).toBe(4);
    // 36 + 3 + 96 + 1
    expect(res.codes).toHaveLength(136);
    expect(res.codes).toContain('H6/R4/ED F01-0');
  });

  it('wirft doppelte Codes aus überlappenden Läufen heraus', () => {
    const res = codesAusTabelle('1 | 7 | A | 5 | 0\n1 | 7 | A | 5 | 0');
    expect(res.codes).toEqual(['H1/R7/EA F05-0']);
    expect(res.doppelt).toBe(1);
  });

  it('sammelt Fehler, liefert die brauchbaren Zeilen aber trotzdem', () => {
    const res = codesAusTabelle('1 | 7 | A | 5 | 0\nUnfug\n1 | 7 | A | 6 | 0');
    expect(res.codes).toHaveLength(2);
    expect(res.fehler).toHaveLength(1);
  });
});

describe('leseLaeufe', () => {
  it('zählt Läufe und Fehler getrennt', () => {
    const res = leseLaeufe(TABELLE);
    expect(res.laeufe).toHaveLength(4);
    expect(res.fehler).toHaveLength(0);
  });
});
