import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { estimateYearlyKwh, fitPanels, panelsToFeatureCollection } from '@/lib/panel-grid';
import type { Feature, Polygon } from 'geojson';

function rect(centerLng: number, centerLat: number, widthM: number, heightM: number): Feature<Polygon> {
  const c = turf.point([centerLng, centerLat]);
  const ne = turf.destination(c, Math.sqrt((widthM / 2) ** 2 + (heightM / 2) ** 2) / 1000, 45, { units: 'kilometers' });
  const sw = turf.destination(c, Math.sqrt((widthM / 2) ** 2 + (heightM / 2) ** 2) / 1000, -135, { units: 'kilometers' });
  const se = turf.destination(c, Math.sqrt((widthM / 2) ** 2 + (heightM / 2) ** 2) / 1000, 135, { units: 'kilometers' });
  const nw = turf.destination(c, Math.sqrt((widthM / 2) ** 2 + (heightM / 2) ** 2) / 1000, -45, { units: 'kilometers' });
  const a = (sw.geometry.coordinates as [number, number]);
  const b = (se.geometry.coordinates as [number, number]);
  const cc = (ne.geometry.coordinates as [number, number]);
  const d = (nw.geometry.coordinates as [number, number]);
  return turf.polygon([[a, b, cc, d, a]]);
}

describe('fitPanels', () => {
  it('returns empty layout for a degenerate polygon', () => {
    const layout = fitPanels({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] }, properties: {} });
    expect(layout.count).toBe(0);
    expect(layout.totalKwp).toBe(0);
  });

  it('places a reasonable number of panels on a 10×6 m roof', () => {
    const roof = rect(7, 51, 10, 6);
    const layout = fitPanels(roof);
    // Theoretical max: 10/1.7 × 6/1.1 ≈ 5 × 5 = 25 panels — but with setback and gap, expect fewer.
    expect(layout.count).toBeGreaterThan(8);
    expect(layout.count).toBeLessThan(30);
    expect(layout.totalKwp).toBeCloseTo((layout.count * 400) / 1000, 5);
  });

  it('respects custom segmentId', () => {
    const roof = rect(7, 51, 10, 6);
    const layout = fitPanels(roof, { segmentId: 'roof-A' });
    if (layout.panels.length > 0) {
      expect(layout.panels[0]?.properties.segmentId).toBe('roof-A');
    }
  });

  it('returns 400 Wp panels by default', () => {
    const roof = rect(7, 51, 10, 6);
    const layout = fitPanels(roof);
    expect(layout.panelDimensions.width).toBe(1.7);
    expect(layout.panelDimensions.height).toBe(1.1);
  });

  it('returns empty when polygon is smaller than a single panel + setback', () => {
    const tiny = rect(7, 51, 1, 1);
    const layout = fitPanels(tiny);
    expect(layout.count).toBe(0);
  });
});

describe('panelsToFeatureCollection', () => {
  it('wraps panels into a GeoJSON FeatureCollection', () => {
    const roof = rect(7, 51, 10, 6);
    const layout = fitPanels(roof);
    const fc = panelsToFeatureCollection(layout.panels);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBe(layout.panels.length);
  });
});

describe('estimateYearlyKwh', () => {
  it('peaks at 35° tilt south orientation', () => {
    const optimal = estimateYearlyKwh(8, 35, 180);
    const flat = estimateYearlyKwh(8, 0, 180);
    const east = estimateYearlyKwh(8, 35, 90);
    expect(optimal).toBeGreaterThanOrEqual(flat);
    expect(optimal).toBeGreaterThanOrEqual(east);
  });

  it('returns ~8000 kWh for 8 kWp at optimal orientation', () => {
    expect(estimateYearlyKwh(8, 35, 180)).toBeCloseTo(8000, -2);
  });

  it('clamps with minimum factor — never returns 0 for a non-zero kWp at any orientation', () => {
    expect(estimateYearlyKwh(8, 90, 0)).toBeGreaterThan(0);
  });
});
