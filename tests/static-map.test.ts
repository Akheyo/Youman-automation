import { describe, expect, it } from 'vitest';
import {
  dimensionsFromPolygon,
  lngLatToPixel,
  metersPerPixel,
  pixelToLngLat,
  type StaticMapView,
} from '@/lib/static-map';

describe('static-map — Pixel ↔ LngLat', () => {
  const view: StaticMapView = {
    centerLng: 6.85, // Borken
    centerLat: 51.84,
    zoom: 19,
    widthPx: 800,
    heightPx: 600,
  };

  it('Bildmitte entspricht dem Center-LngLat', () => {
    const [lng, lat] = pixelToLngLat(400, 300, view);
    expect(lng).toBeCloseTo(view.centerLng, 5);
    expect(lat).toBeCloseTo(view.centerLat, 5);
  });

  it('Pixel→LngLat→Pixel ist Identität', () => {
    const [lng, lat] = pixelToLngLat(123, 456, view);
    const [px, py] = lngLatToPixel(lng, lat, view);
    expect(px).toBeCloseTo(123, 4);
    expect(py).toBeCloseTo(456, 4);
  });

  it('metersPerPixel bei Zoom 19 in NRW ≈ 0.18 m/px', () => {
    const mpp = metersPerPixel(51.84, 19);
    expect(mpp).toBeGreaterThan(0.15);
    expect(mpp).toBeLessThan(0.25);
  });
});

describe('dimensionsFromPolygon', () => {
  it('Rechteck 10 m × 6 m liefert First=10, Breite=6', () => {
    // 10 m east-west × 6 m north-south, in Borken.
    // 1° lng ≈ 111320·cos(51.84°) ≈ 68800 m → 10 m ≈ 0.0001454°
    // 1° lat ≈ 110540 m → 6 m ≈ 0.0000543°
    const lng0 = 6.85;
    const lat0 = 51.84;
    const dLng = 10 / (111320 * Math.cos((lat0 * Math.PI) / 180));
    const dLat = 6 / 110540;
    const ring: [number, number][] = [
      [lng0, lat0],
      [lng0 + dLng, lat0],
      [lng0 + dLng, lat0 + dLat],
      [lng0, lat0 + dLat],
      [lng0, lat0], // closed
    ];
    const dims = dimensionsFromPolygon(ring);
    expect(dims).not.toBeNull();
    expect(dims!.firstLengthM).toBeCloseTo(10, 0);
    expect(dims!.houseWidthM).toBeCloseTo(6, 0);
  });

  it('null bei < 3 Vertices', () => {
    expect(dimensionsFromPolygon([])).toBeNull();
    expect(dimensionsFromPolygon([[0, 0]])).toBeNull();
  });
});
