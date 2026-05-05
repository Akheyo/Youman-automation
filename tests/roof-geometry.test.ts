import { describe, expect, it } from 'vitest';
import {
  computeRoofGeometry,
  hypotenuseFromHalfWidth,
} from '@/lib/roof-geometry';

describe('roof-geometry — Excel-Sheet Validierung', () => {
  it('Hypotenuse C = 5 / cos(40°) ≈ 6.53 m bei rechtem First-Winkel', () => {
    const c = hypotenuseFromHalfWidth(5, 40, 90);
    expect(c).toBeCloseTo(6.527, 2);
  });

  it('reproduziert das Sheet-Beispiel (Breite=10, First=10, Pitch=40°, Wp=450, m²=2)', () => {
    const result = computeRoofGeometry({
      firstLengthM: 10,
      houseWidthM: 10,
      pitchDeg: 40,
      ridgeAngleDeg: 90,
      panelWattPeak: 450,
      panelAreaM2: 2,
      roofType: 'satteldach',
    });

    expect(result.sides).toHaveLength(2);
    const a = result.sides[0]!;
    expect(a.label).toBe('A');
    expect(a.hypotenuseM).toBeCloseTo(6.53, 1);
    expect(a.areaM2).toBeCloseTo(65.27, 1);
    expect(a.panelCount).toBe(32);
    expect(a.kwp).toBeCloseTo(14.4, 2);

    const b = result.sides[1]!;
    expect(b.kwp).toBeCloseTo(14.4, 2);

    expect(result.totalKwp).toBeCloseTo(28.8, 2);
    expect(result.totalPanels).toBe(64);
  });

  it('Pultdach hat nur eine Seite und nutzt die volle Hausbreite', () => {
    const result = computeRoofGeometry({
      firstLengthM: 10,
      houseWidthM: 10,
      pitchDeg: 15,
      roofType: 'pultdach',
    });
    expect(result.sides).toHaveLength(1);
    // Volle 10 m Breite, 15° Neigung → Hypotenuse ≈ 10/cos(15°) ≈ 10.353 m
    expect(result.sides[0]!.hypotenuseM).toBeCloseTo(10.35, 1);
  });

  it('Walmdach liefert vier Seiten (zwei Trapeze, zwei Walmen)', () => {
    const result = computeRoofGeometry({
      firstLengthM: 12,
      houseWidthM: 10,
      pitchDeg: 35,
      roofType: 'walmdach',
    });
    expect(result.sides).toHaveLength(4);
    expect(result.sides.map((s) => s.label)).toEqual(['A', 'B', 'C', 'D']);
    // Trapeze A/B müssen größer sein als Walmen C/D bei dieser Geometrie.
    expect(result.sides[0]!.areaM2).toBeGreaterThan(result.sides[2]!.areaM2);
  });

  it('clamped sicher bei degenerierten Eingaben', () => {
    const result = computeRoofGeometry({
      firstLengthM: 0,
      houseWidthM: 10,
      pitchDeg: 40,
    });
    expect(result.totalKwp).toBe(0);
    expect(result.totalPanels).toBe(0);
  });
});
