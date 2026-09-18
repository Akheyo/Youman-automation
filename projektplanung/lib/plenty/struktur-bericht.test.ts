/**
 * Der Bericht muss vor allem eins können: nicht behaupten, was er nicht weiß.
 * Ein fehlender Laufweg-Haken und ein Feld, das die API gar nicht mitschickt,
 * sehen im Backend gleich aus — im Bericht dürfen sie es nicht.
 */
import { describe, expect, it } from 'vitest';

import { strukturBericht } from './struktur-bericht';

const VIER = [
  { id: 11, level: 1, name: 'Halle', shortcut: 'H', isRelevantForRoute: true },
  { id: 12, level: 2, name: 'Regal', shortcut: 'R', isRelevantForRoute: true },
  { id: 13, level: 3, name: 'Ebene', shortcut: 'E', isRelevantForRoute: true },
  { id: 14, level: 4, name: 'Feld', shortcut: 'F', isRelevantForRoute: false },
];

describe('strukturBericht', () => {
  it('sagt bei einem leeren Lager, dass nichts eingerichtet ist', () => {
    const zeilen = strukturBericht({ dimensionen: [] });
    expect(zeilen[0]).toContain('keine einzige Strukturspalte');
    expect(zeilen.at(-1)).toContain('Anlegen nicht möglich');
  });

  it('zählt die Spalten und nennt sie beim Namen', () => {
    const zeilen = strukturBericht({
      dimensionen: { entries: VIER },
      knotenGesamt: 3,
      vollstaendig: true,
      knotenJeDimension: [{ dimensionId: 11, anzahl: 1 }],
      obersteKnoten: [{ id: 900, name: 'H1', dimensionId: 11 }],
    });
    expect(zeilen[0]).toContain('Halle');
    expect(zeilen[0]).toContain('„H"');
    expect(zeilen[0]).toContain('1 Knoten');
    expect(zeilen.some((z) => z.includes('H1 (ID 900)'))).toBe(true);
    expect(zeilen.some((z) => z.includes('Anlegen ist möglich'))).toBe(true);
  });

  it('gibt jeden Ja/Nein-Schalter mit seinem echten Namen aus', () => {
    const zeilen = strukturBericht({ dimensionen: VIER, obersteKnoten: [] });
    expect(zeilen[0]).toContain('isRelevantForRoute: ja');
    expect(zeilen[3]).toContain('isRelevantForRoute: nein');
  });

  it('nimmt auch 0/1 und "true"/"false" als Schalter', () => {
    const zeilen = strukturBericht({
      dimensionen: [{ id: 1, level: 1, name: 'Halle', shortcut: 'H', a: 1, b: 0, c: 'true' }],
    });
    expect(zeilen[0]).toContain('a: ja');
    expect(zeilen[0]).toContain('b: nein');
    expect(zeilen[0]).toContain('c: ja');
  });

  it('behauptet keinen fehlenden Haken, wenn die API gar keinen schickt', () => {
    const zeilen = strukturBericht({
      dimensionen: [{ id: 1, level: 1, name: 'Halle', shortcut: 'H' }],
    });
    expect(zeilen[0]).toContain('keine Ja/Nein-Felder in der Antwort');
    expect(zeilen.at(-1)).toContain('nicht „Haken fehlt"');
  });

  it('sagt beim leeren Lager, dass die erste Halle unter Wurzel 0 entsteht', () => {
    const zeilen = strukturBericht({
      dimensionen: VIER,
      knotenGesamt: 0,
      vollstaendig: true,
      obersteKnoten: [],
    });
    expect(zeilen.some((z) => z.includes('Wurzel 0'))).toBe(true);
  });

  it('legt nicht an, solange die Knotenliste unvollständig ist', () => {
    const zeilen = strukturBericht({
      dimensionen: VIER,
      knotenGesamt: 5,
      vollstaendig: false,
      obersteKnoten: [{ id: 900, name: 'H1', dimensionId: 11 }],
    });
    expect(zeilen.some((z) => z.includes('nicht vollständig lesbar'))).toBe(true);
  });

  it('sortiert die Spalten nach Tiefe, egal wie sie ankommen', () => {
    const zeilen = strukturBericht({ dimensionen: [...VIER].reverse() });
    expect(zeilen[0]).toContain('Halle');
    expect(zeilen[3]).toContain('Feld');
  });
});
