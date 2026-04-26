/**
 * Pure geo helpers used by both the API and the UI.
 *
 * Everything here is small and side-effect-free, so it works in the browser
 * and in the Node API runtime without changes.
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
 *   1. Polygon that contains the address point (if any).
 *   2. Otherwise, the polygon with the closest centroid.
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

/** Polygon area in m² using Turf (computes on a sphere; accurate at building scale). */
export function polygonAreaM2(poly: Feature<Polygon>): number {
  return turf.area(poly);
}

/**
 * Estimate a building footprint's longest-edge bearing.
 * Used to align the panel grid with the building so it packs more efficiently
 * than an axis-aligned grid.
 *
 * Returns degrees (0–180; we work mod 180 because a rectangle is symmetric).
 */
export function longestEdgeBearing(ring: Position[]): number {
  let maxLen = 0;
  let bearing = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = turf.point(ring[i] as [number, number]);
    const b = turf.point(ring[i + 1] as [number, number]);
    const len = turf.distance(a, b, { units: 'meters' });
    if (len > maxLen) {
      maxLen = len;
      bearing = turf.bearing(a, b);
    }
  }
  // turf.bearing returns -180..180. Normalise to 0..180.
  let deg = ((bearing % 180) + 180) % 180;
  return deg;
}
