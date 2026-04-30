import { describe, expect, it } from 'vitest';
import { buildProceduralHouse } from '@/lib/procedural-house';

const rect = (cx: number, cy: number, w = 0.0001, h = 0.00006) => [
  [cx - w, cy - h],
  [cx + w, cy - h],
  [cx + w, cy + h],
  [cx - w, cy + h],
  [cx - w, cy - h],
] as [number, number][];

describe('buildProceduralHouse', () => {
  it('produces walls, roof slopes, and gables', () => {
    const house = buildProceduralHouse({ footprint: rect(7, 51) });
    const kinds = house.parts.map((p) => p.kind).sort();
    expect(kinds.filter((k) => k === 'wall')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'roofSlope')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'gable')).toHaveLength(2);
    expect(house.roofSlopes).toHaveLength(2);
  });

  it('ridge is higher than eave', () => {
    const house = buildProceduralHouse({ footprint: rect(7, 51), eaveHeightM: 6, pitchDeg: 30 });
    expect(house.ridgeHeightM).toBeGreaterThan(house.eaveHeightM);
    expect(house.ridgeHeightM).toBeLessThan(house.eaveHeightM + 20);
  });

  it('clamps absurd pitch values', () => {
    const flat = buildProceduralHouse({ footprint: rect(7, 51), pitchDeg: -10 });
    const steep = buildProceduralHouse({ footprint: rect(7, 51), pitchDeg: 200 });
    // both should still produce valid heights
    expect(flat.ridgeHeightM).toBeGreaterThan(flat.eaveHeightM);
    expect(steep.ridgeHeightM).toBeGreaterThan(steep.eaveHeightM);
  });

  it('every roof slope has 5 closed-ring vertices (4 corners + closing)', () => {
    const house = buildProceduralHouse({ footprint: rect(7, 51) });
    for (const s of house.roofSlopes) {
      expect(s.positions).toHaveLength(5);
      const first = s.positions[0]!;
      const last = s.positions[s.positions.length - 1]!;
      expect(first[0]).toBe(last[0]);
      expect(first[1]).toBe(last[1]);
    }
  });

  it('returns empty house for degenerate footprint', () => {
    const empty = buildProceduralHouse({ footprint: [[7, 51]] });
    expect(empty.parts).toHaveLength(0);
  });

  it('honours custom ridge bearing', () => {
    const house = buildProceduralHouse({ footprint: rect(7, 51), ridgeBearingDeg: 45 });
    expect(house.ridgeBearingDeg).toBe(45);
  });

  it('roof colour is the orange tile shade', () => {
    const house = buildProceduralHouse({ footprint: rect(7, 51) });
    const roofColour = house.roofSlopes[0]?.color;
    expect(roofColour).toMatch(/^#c7400a$/i);
  });
});
