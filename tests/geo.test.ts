import { describe, expect, it } from 'vitest';
import {
  azimuthToPvgisAspect,
  bboxAround,
  buildingToFeature,
  longestEdgeBearing,
  pickClosestBuilding,
  polygonAreaM2,
} from '@/lib/geo';
import type { BuildingFootprint } from '@/types';

const square = (cx: number, cy: number, side = 0.0001): BuildingFootprint => ({
  id: Math.floor(Math.random() * 1e9),
  coordinates: [
    [cx - side, cy - side],
    [cx + side, cy - side],
    [cx + side, cy + side],
    [cx - side, cy + side],
    [cx - side, cy - side],
  ],
});

describe('buildingToFeature', () => {
  it('wraps a footprint into a GeoJSON Polygon Feature', () => {
    const b = square(7, 51);
    const f = buildingToFeature(b);
    expect(f.geometry.type).toBe('Polygon');
    expect(f.geometry.coordinates[0]).toHaveLength(5);
  });
});

describe('pickClosestBuilding', () => {
  it('returns null for empty input', () => {
    expect(pickClosestBuilding([], 7, 51)).toBeNull();
  });

  it('prefers the building containing the point', () => {
    const containing = square(7, 51, 0.001);
    const adjacent = square(7.01, 51.01, 0.001);
    const result = pickClosestBuilding([adjacent, containing], 7, 51);
    expect(result?.id).toBe(containing.id);
  });

  it('falls back to nearest centroid when no building contains the point', () => {
    const a = square(7, 51, 0.0005);
    const b = square(7.05, 51.05, 0.0005);
    const result = pickClosestBuilding([b, a], 7.001, 51.001);
    expect(result?.id).toBe(a.id);
  });
});

describe('polygonAreaM2', () => {
  it('returns positive area for a real polygon', () => {
    const f = buildingToFeature(square(7, 51, 0.0001));
    const area = polygonAreaM2(f);
    // 0.0001 deg ≈ 11 m at 51° lat, so ~22 m × 11 m ≈ 240 m²
    expect(area).toBeGreaterThan(100);
    expect(area).toBeLessThan(500);
  });
});

describe('longestEdgeBearing', () => {
  it('returns 0..180', () => {
    const ring = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.005],
      [0, 0.005],
      [0, 0],
    ];
    const b = longestEdgeBearing(ring);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(180);
  });

  it('returns 0 for an empty ring without crashing', () => {
    expect(longestEdgeBearing([])).toBe(0);
  });
});

describe('bboxAround', () => {
  it('produces a bbox roughly `paddingM` meters around the center', () => {
    const [minLng, minLat, maxLng, maxLat] = bboxAround(51, 7, 100);
    // 100 m at 51° lat ≈ 0.0009 deg lat, ~0.0014 deg lng.
    expect(maxLat - minLat).toBeGreaterThan(0.0015);
    expect(maxLat - minLat).toBeLessThan(0.0025);
    expect(maxLng - minLng).toBeGreaterThan(0.0025);
    expect(maxLng - minLng).toBeLessThan(0.004);
  });
});

describe('azimuthToPvgisAspect', () => {
  it('maps 180° (south) to 0°', () => {
    expect(azimuthToPvgisAspect(180)).toBe(0);
  });
  it('maps 90° (east) to -90°', () => {
    expect(azimuthToPvgisAspect(90)).toBe(-90);
  });
  it('maps 270° (west) to 90°', () => {
    expect(azimuthToPvgisAspect(270)).toBe(90);
  });
  it('keeps result within [-180, 180]', () => {
    for (let az = 0; az <= 360; az += 17) {
      const a = azimuthToPvgisAspect(az);
      expect(a).toBeGreaterThanOrEqual(-180);
      expect(a).toBeLessThanOrEqual(180);
    }
  });
});
