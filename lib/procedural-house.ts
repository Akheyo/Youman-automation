/**
 * Procedural house generator.
 *
 * Given an OSM building footprint, generates a 3D house mesh as a set of
 * Cesium polygon entity definitions:
 *
 *   - 4 wall panels (extruded from ground to eave height)
 *   - 2 roof slopes (sloped trapezoids from eave to ridge)
 *   - 2 gable ends (triangles closing off the short sides)
 *
 * This is the same approach Solarplaner/envolta use: take the OSM polygon,
 * extrude walls to ~6m, then build a saddle roof aligned with the longest
 * edge using the cadastre's tilt and azimuth.
 *
 * Limitations:
 *   - Only handles convex / near-rectangular footprints. L-shapes get a
 *     simplified bounding-rectangle roof (still better than a flat box).
 *   - Roof type is always Satteldach (saddle). Walmdach/Pultdach come later.
 *   - Heights are approximate — exact LoD2 is the production path.
 */

import * as turf from '@turf/turf';
import type { Position } from 'geojson';

export interface ProceduralHouseInput {
  /** Closed OSM ring [lng, lat], first === last. */
  footprint: Position[];
  /** Eave height (top of wall) in meters. Default 6 (1.5-storey house). */
  eaveHeightM?: number;
  /** Roof pitch in degrees. Default 35 (typical NRW residential). */
  pitchDeg?: number;
  /** Bearing of the ridge line in degrees [0..180). If omitted, longest edge bearing is used. */
  ridgeBearingDeg?: number;
}

export interface ProceduralHousePart {
  /** Unique sub-id ("wall_N" / "roof_S" / "gable_E"). */
  kind: 'wall' | 'roofSlope' | 'gable';
  /** Polygon ring, each vertex with [lng, lat, height in m]. */
  positions: [number, number, number][];
  /** Hex colour suggested for material. */
  color: string;
}

export interface ProceduralHouse {
  parts: ProceduralHousePart[];
  /** The two roof slopes (north & south of ridge), useful for module placement. */
  roofSlopes: ProceduralHousePart[];
  /** Bearing of the ridge in degrees, normalised 0..180. */
  ridgeBearingDeg: number;
  /** Eave height. */
  eaveHeightM: number;
  /** Ridge height (eave + tan(pitch) * width/2). */
  ridgeHeightM: number;
}

const DEFAULT = {
  eaveHeightM: 6,
  pitchDeg: 35,
};

const COLOR_WALL = '#e8dfd0';
const COLOR_ROOF = '#c7400a'; // warm tile-red/orange
const COLOR_GABLE = '#dcd1bd';

/**
 * Build a procedural house from a footprint.
 */
export function buildProceduralHouse(input: ProceduralHouseInput): ProceduralHouse {
  const eaveH = input.eaveHeightM ?? DEFAULT.eaveHeightM;
  const pitch = clampPitch(input.pitchDeg ?? DEFAULT.pitchDeg);

  // Step 1: simplify to oriented bounding rectangle. Robust for any footprint.
  const ring = ensureClosedRing(input.footprint);
  if (ring.length < 4) {
    return emptyHouse(normaliseBearing(input.ridgeBearingDeg ?? 0), eaveH);
  }
  const ridgeBearing = normaliseBearing(input.ridgeBearingDeg ?? longestEdgeBearing(ring));

  // Compute oriented bounding rectangle by rotating the footprint so the ridge
  // direction aligns with X, then taking axis-aligned bbox, then rotating back.
  const polygon = turf.polygon([ring]);
  const pivot = turf.centroid(polygon);
  const aligned = turf.transformRotate(polygon, -ridgeBearing, { pivot });
  const [minX, minY, maxX, maxY] = turf.bbox(aligned);
  if (minX === undefined || minY === undefined || maxX === undefined || maxY === undefined) {
    return emptyHouse(ridgeBearing, eaveH);
  }

  // Long axis (parallel to ridge) — east-west in the aligned frame.
  // Short axis (perpendicular to ridge) — north-south in the aligned frame.
  const sw: [number, number, number] = [minX, minY, 0];
  const se: [number, number, number] = [maxX, minY, 0];
  const ne: [number, number, number] = [maxX, maxY, 0];
  const nw: [number, number, number] = [minX, maxY, 0];

  // Width in meters along the SHORT axis (perpendicular to ridge) — needed for ridge height.
  const widthM = turf.distance(turf.point([minX, minY]), turf.point([minX, maxY]), { units: 'meters' });
  const ridgeHalfRise = (widthM / 2) * Math.tan((pitch * Math.PI) / 180);
  const ridgeH = eaveH + ridgeHalfRise;

  // Ridge endpoints in the aligned frame: along centre of short axis.
  const midY = (minY + maxY) / 2;
  const ridgeWest: [number, number, number] = [minX, midY, ridgeH];
  const ridgeEast: [number, number, number] = [maxX, midY, ridgeH];

  // Build aligned-frame parts.
  const parts: ProceduralHousePart[] = [];

  // Walls (4 vertical rectangles, ground → eaveH).
  parts.push({
    kind: 'wall',
    color: COLOR_WALL,
    positions: [withZ(sw, 0), withZ(se, 0), withZ(se, eaveH), withZ(sw, eaveH), withZ(sw, 0)],
  });
  parts.push({
    kind: 'wall',
    color: COLOR_WALL,
    positions: [withZ(se, 0), withZ(ne, 0), withZ(ne, eaveH), withZ(se, eaveH), withZ(se, 0)],
  });
  parts.push({
    kind: 'wall',
    color: COLOR_WALL,
    positions: [withZ(ne, 0), withZ(nw, 0), withZ(nw, eaveH), withZ(ne, eaveH), withZ(ne, 0)],
  });
  parts.push({
    kind: 'wall',
    color: COLOR_WALL,
    positions: [withZ(nw, 0), withZ(sw, 0), withZ(sw, eaveH), withZ(nw, eaveH), withZ(nw, 0)],
  });

  // Roof slope south (sw eave → se eave → ridgeEast → ridgeWest)
  const slopeSouth: ProceduralHousePart = {
    kind: 'roofSlope',
    color: COLOR_ROOF,
    positions: [
      withZ(sw, eaveH),
      withZ(se, eaveH),
      ridgeEast,
      ridgeWest,
      withZ(sw, eaveH),
    ],
  };
  // Roof slope north (nw eave → ne eave → ridgeEast → ridgeWest)
  const slopeNorth: ProceduralHousePart = {
    kind: 'roofSlope',
    color: COLOR_ROOF,
    positions: [
      withZ(nw, eaveH),
      withZ(ne, eaveH),
      ridgeEast,
      ridgeWest,
      withZ(nw, eaveH),
    ],
  };
  parts.push(slopeSouth, slopeNorth);

  // Gable ends (triangles above eave, on east and west short sides).
  parts.push({
    kind: 'gable',
    color: COLOR_GABLE,
    positions: [withZ(sw, eaveH), withZ(nw, eaveH), ridgeWest, withZ(sw, eaveH)],
  });
  parts.push({
    kind: 'gable',
    color: COLOR_GABLE,
    positions: [withZ(se, eaveH), withZ(ne, eaveH), ridgeEast, withZ(se, eaveH)],
  });

  // Step 2: rotate every vertex back to original geographic orientation.
  // We pivot lng/lat around the polygon centroid, keeping z untouched.
  const pivotLng = pivot.geometry.coordinates[0] as number;
  const pivotLat = pivot.geometry.coordinates[1] as number;
  const cosA = Math.cos((ridgeBearing * Math.PI) / 180);
  const sinA = Math.sin((ridgeBearing * Math.PI) / 180);

  function rotateBack(p: [number, number, number]): [number, number, number] {
    // Use turf.destination to handle lat/lng rotation accurately at this scale.
    const dx = p[0] - pivotLng;
    const dy = p[1] - pivotLat;
    // Approximate planar rotation — fine at building scale (<200m).
    const rx = dx * cosA - dy * sinA;
    const ry = dx * sinA + dy * cosA;
    return [pivotLng + rx, pivotLat + ry, p[2]];
  }

  const rotated: ProceduralHousePart[] = parts.map((part) => ({
    ...part,
    positions: part.positions.map(rotateBack),
  }));

  return {
    parts: rotated,
    roofSlopes: rotated.filter((p) => p.kind === 'roofSlope'),
    ridgeBearingDeg: ridgeBearing,
    eaveHeightM: eaveH,
    ridgeHeightM: ridgeH,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clampPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return DEFAULT.pitchDeg;
  return Math.max(5, Math.min(60, pitch));
}

function normaliseBearing(bearing: number): number {
  return ((bearing % 180) + 180) % 180;
}

function ensureClosedRing(ring: Position[]): Position[] {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, [first[0], first[1]] as Position];
}

function longestEdgeBearing(ring: Position[]): number {
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
  return ((bearing % 180) + 180) % 180;
}

function withZ(p: [number, number, number], z: number): [number, number, number] {
  return [p[0], p[1], z];
}

function emptyHouse(ridgeBearingDeg: number, eaveHeightM: number): ProceduralHouse {
  return {
    parts: [],
    roofSlopes: [],
    ridgeBearingDeg,
    eaveHeightM,
    ridgeHeightM: eaveHeightM,
  };
}
