/**
 * Geo helpers — pure functions usable in browser, Node API runtime, and tests.
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';
import type { BuildingFootprint } from '@/types';

/** Wrap an OSM ring into a GeoJSON Polygon Feature. */
export function buildingToFeature(b: BuildingFootprint): Feature<Polygon> {
  return turf.polygon([b.coordinates], {
    osmId: b.id,
    height: b.height ?? null,
  });
}

/**
 * Pick the building most likely to be the user's address.
 * Strategy:
 *   1. Polygon that contains the address point (if any) — preferred.
 *   2. Otherwise, the polygon with the closest centroid.
 *
 * Returns null if no buildings provided.
 */
export function pickClosestBuilding(
  buildings: BuildingFootprint[],
  lng: number,
  lat: number,
): BuildingFootprint | null {
  if (buildings.length === 0) return null;
  const point = turf.point([lng, lat]);

  for (const b of buildings) {
    const poly = buildingToFeature(b);
    if (turf.booleanPointInPolygon(point, poly)) return b;
  }

  let best: BuildingFootprint | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    const poly = buildingToFeature(b);
    const c = turf.centroid(poly);
    const d = turf.distance(point, c, { units: 'meters' });
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

/** Polygon area in m² using Turf (sphere; accurate at building scale). */
export function polygonAreaM2(poly: Feature<Polygon>): number {
  return turf.area(poly);
}

/**
 * Bearing of the polygon's longest edge, normalised to [0, 180).
 * Used to align panel grids with the dominant building direction.
 */
export function longestEdgeBearing(ring: Position[]): number {
  let maxLen = 0;
  let bearing = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!a || !b) continue;
    const pa = turf.point(a as [number, number]);
    const pb = turf.point(b as [number, number]);
    const len = turf.distance(pa, pb, { units: 'meters' });
    if (len > maxLen) {
      maxLen = len;
      bearing = turf.bearing(pa, pb);
    }
  }
  // Normalise to 0..180 (a rectangle is symmetric around 180°).
  return ((bearing % 180) + 180) % 180;
}

/**
 * Bounding box around (lat, lng) as `[minLng, minLat, maxLng, maxLat]` with
 * approximately `paddingM` meters of buffer on each side.
 */
export function bboxAround(lat: number, lng: number, paddingM: number): [number, number, number, number] {
  const center = turf.point([lng, lat]);
  // 4 destinations: N, S, E, W
  const north = turf.destination(center, paddingM / 1000, 0, { units: 'kilometers' });
  const south = turf.destination(center, paddingM / 1000, 180, { units: 'kilometers' });
  const east = turf.destination(center, paddingM / 1000, 90, { units: 'kilometers' });
  const west = turf.destination(center, paddingM / 1000, -90, { units: 'kilometers' });
  return [
    west.geometry.coordinates[0] as number,
    south.geometry.coordinates[1] as number,
    east.geometry.coordinates[0] as number,
    north.geometry.coordinates[1] as number,
  ];
}

/**
 * Convert NRW Solarkataster azimuth (0=N, 180=S) to PVGIS aspect (0=S, ±90=E/W).
 * Range wraps to [-180, 180].
 */
export function azimuthToPvgisAspect(azimuthDeg: number): number {
  let aspect = azimuthDeg - 180;
  if (aspect > 180) aspect -= 360;
  if (aspect < -180) aspect += 360;
  return aspect;
}
