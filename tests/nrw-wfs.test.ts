import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { filterSegmentsForBuilding, isInNRW } from '@/lib/nrw-wfs';
import type { BuildingFootprint, NrwRoofSegment } from '@/types';

describe('isInNRW', () => {
  it('accepts Borken (NRW pilot region)', () => {
    expect(isInNRW(51.84, 6.86)).toBe(true);
  });
  it('rejects München (BY)', () => {
    expect(isInNRW(48.137, 11.575)).toBe(false);
  });
  it('rejects Hamburg', () => {
    expect(isInNRW(53.55, 10.0)).toBe(false);
  });
});

function seg(id: string, cx: number, cy: number): NrwRoofSegment {
  const side = 0.00005;
  return {
    id,
    polygon: turf.polygon([[
      [cx - side, cy - side],
      [cx + side, cy - side],
      [cx + side, cy + side],
      [cx - side, cy + side],
      [cx - side, cy - side],
    ]]),
    azimuthDeg: 180,
    pitchDeg: 30,
    suitability: 'gut',
    yieldKwh: 1000,
    moduleCount: 4,
    areaM2: 8,
  };
}

describe('filterSegmentsForBuilding', () => {
  it('keeps only segments inside the building footprint', () => {
    const inside = seg('a', 7, 51);
    const outside = seg('b', 7.01, 51.01);
    const building: BuildingFootprint = {
      id: 1,
      coordinates: [
        [6.9999, 50.9999],
        [7.0001, 50.9999],
        [7.0001, 51.0001],
        [6.9999, 51.0001],
        [6.9999, 50.9999],
      ],
    };
    const result = filterSegmentsForBuilding([inside, outside], building, { lat: 51, lng: 7 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });

  it('falls back to nearest + neighbours when no building given', () => {
    const a = seg('a', 7, 51);
    const b = seg('b', 7.0001, 51); // ~7m away — within neighbour threshold
    const c = seg('c', 7.05, 51);   // far
    const result = filterSegmentsForBuilding([a, b, c], null, { lat: 51, lng: 7 });
    expect(result.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('returns empty array for empty input', () => {
    expect(filterSegmentsForBuilding([], null, { lat: 51, lng: 7 })).toEqual([]);
  });
});
