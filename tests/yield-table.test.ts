import { describe, expect, it } from 'vitest';
import {
  YIELD_AVERAGE,
  YIELD_TABLE,
  aspectFromAzimuth,
  regionFromPlz,
  specificYield,
  totalYield,
  yieldPerSide,
} from '@/lib/yield-table';

describe('yield-table — Sheet 2 Validierung', () => {
  it('Tabellenwerte stimmen mit dem Sheet überein', () => {
    expect(YIELD_TABLE.norden.sued).toBe(900);
    expect(YIELD_TABLE.osten.sued).toBe(1000);
    expect(YIELD_TABLE['mitte-westen'].sued).toBe(975);
    expect(YIELD_TABLE.sueden.sued).toBe(1100);

    expect(YIELD_TABLE.norden.nord).toBe(540);
    expect(YIELD_TABLE.sueden.ost).toBe(825);
    expect(YIELD_TABLE['mitte-westen'].west).toBe(710);
  });

  it('Durchschnitt der vier Regionen entspricht der "Durchschnitt"-Spalte', () => {
    expect(YIELD_AVERAGE.sued).toBeCloseTo(993.75, 2);
    expect(YIELD_AVERAGE.ost).toBe(745);
    expect(YIELD_AVERAGE.west).toBe(725);
    expect(YIELD_AVERAGE.nord).toBeCloseTo(596.25, 2);
  });

  it('PLZ → Region', () => {
    expect(regionFromPlz('46325')).toBe('mitte-westen'); // Borken
    expect(regionFromPlz('22587')).toBe('norden');       // Hamburg
    expect(regionFromPlz('01067')).toBe('osten');        // Dresden
    expect(regionFromPlz('80331')).toBe('sueden');       // München
    expect(regionFromPlz('99999')).toBe('sueden');
    expect(regionFromPlz(null)).toBeNull();
    expect(regionFromPlz('abc')).toBeNull();
  });

  it('aspectFromAzimuth deckt alle vier Quadranten ab', () => {
    expect(aspectFromAzimuth(0)).toBe('nord');
    expect(aspectFromAzimuth(89)).toBe('ost');
    expect(aspectFromAzimuth(180)).toBe('sued');
    expect(aspectFromAzimuth(270)).toBe('west');
    expect(aspectFromAzimuth(355)).toBe('nord');
  });

  it('reproduziert das Anlagenertrag-Beispiel aus Sheet 2 (Mitte/Westen-Durchschnitt)', () => {
    // Beispiel: 14.4 kWp Seite A OST + 14.4 kWp Seite B WEST, ohne PLZ → Durchschnitt.
    // Seite A: 14.4 · 745 = 10728
    // Seite B: 14.4 · 725 = 10440
    // Gesamt: 21168
    expect(yieldPerSide(14.4, null, 'ost')).toBe(10728);
    expect(yieldPerSide(14.4, null, 'west')).toBe(10440);
    expect(
      totalYield(
        [
          { kwp: 14.4, aspect: 'ost' },
          { kwp: 14.4, aspect: 'west' },
        ],
        null,
      ),
    ).toBe(21168);
  });

  it('mit PLZ in Mitte/Westen: andere Erträge als der Durchschnitt', () => {
    // Mitte/Westen: Ost=730, West=710
    expect(yieldPerSide(14.4, 'mitte-westen', 'ost')).toBe(Math.round(14.4 * 730));
    expect(yieldPerSide(14.4, 'mitte-westen', 'west')).toBe(Math.round(14.4 * 710));
  });

  it('specificYield ohne Region nutzt Durchschnitt', () => {
    expect(specificYield(null, 'sued')).toBe(993.75);
    expect(specificYield('sueden', 'sued')).toBe(1100);
  });
});
