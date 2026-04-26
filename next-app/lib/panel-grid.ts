/**
 * Panel grid placement.
 *
 * Algorithm:
 *   1. Rotate the polygon so the longest edge aligns with the X axis.
 *      That makes panel rows hug the longest edge, which beats an
 *      axis-aligned bounding box for almost every real building.
 *   2. Project to a flat metric plane around the polygon centroid.
 *   3. Iterate a width × height grid in that plane.
 *   4. Keep panels whose footprint is fully inside the polygon
 *      minus a setback margin (default 0.5 m from the edge).
 *   5. Rotate panels back into geographic coordinates.
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';
import type { PanelLayout, PanelFeature } from '@/types';
import { longestEdgeBearing } from '@/lib/geo';

export interface PanelGridOptions {
  /** Panel width in meters (long side). Default 1.7. */
  panelWidthM?: number;
  /** Panel height in meters (short side). Default 1.1. */
  panelHeightM?: number;
  /** Setback from the polygon edge in meters. Default 0.5. */
  setbackM?: number;
  /** Gap between panels in meters. Default 0.05 (Modulklemmen). */
  gapM?: number;
  /** Watt-peak per panel. Default 400. */
  panelWattPeak?: number;
}

const DEFAULTS: Required<PanelGridOptions> = {
  panelWidthM: 1.7,
  panelHeightM: 1.1,
  setbackM: 0.5,
  gapM: 0.05,
  panelWattPeak: 400,
};

/**
 * Fit panels into the polygon. Returns a layout the UI can render directly.
 *
 * The function never throws on weird input — it simply returns an empty layout
 * if the polygon is too small or degenerate.
 */
export function fitPanels(
  polygon: Feature<Polygon>,
  options: PanelGridOptions = {},
): PanelLayout {
  const opts = { ...DEFAULTS, ...options };

  const ring = polygon.geometry.coordinates[0];
  if (!ring || ring.length < 4) {
    return emptyLayout(opts);
  }

  // Bearing of the longest edge — this is the angle we rotate AWAY by, so
  // that after rotation the long edge runs east-west.
  const bearing = longestEdgeBearing(ring);
  const pivot = turf.centroid(polygon);

  // Step 1: rotate polygon so longest edge is horizontal.
  const aligned = turf.transformRotate(polygon, -bearing, { pivot }) as Feature<Polygon>;

  // Step 2: shrink polygon by the setback margin.
  // turf.buffer with a negative radius gives the inset polygon.
  const inset = opts.setbackM > 0
    ? (turf.buffer(aligned, -opts.setbackM / 1000, { units: 'kilometers' }) as Feature<Polygon> | undefined)
    : aligned;
  if (!inset || !inset.geometry || inset.geometry.coordinates.length === 0) {
    return emptyLayout(opts);
  }

  const bbox = turf.bbox(inset); // [minX, minY, maxX, maxY] in lng/lat
  const [minX, minY, maxX, maxY] = bbox;

  // Step 3: walk the grid in metric space. We use Turf's destination from the
  // bbox south-west corner so the panel size in meters maps to the right
  // delta in lng/lat at this latitude — accurate enough at building scale.
  const swCorner = turf.point([minX, minY]);
  const stepXPoint = turf.destination(swCorner, (opts.panelWidthM + opts.gapM) / 1000, 90, { units: 'kilometers' });
  const stepYPoint = turf.destination(swCorner, (opts.panelHeightM + opts.gapM) / 1000, 0, { units: 'kilometers' });
  const stepX = stepXPoint.geometry.coordinates[0] - minX;
  const stepY = stepYPoint.geometry.coordinates[1] - minY;

  // Half-step to compute panel rectangles centred on each grid cell.
  const panelDX = (turf.destination(swCorner, opts.panelWidthM / 1000, 90, { units: 'kilometers' })
    .geometry.coordinates[0]) - minX;
  const panelDY = (turf.destination(swCorner, opts.panelHeightM / 1000, 0, { units: 'kilometers' })
    .geometry.coordinates[1]) - minY;

  const alignedPanels: PanelFeature[] = [];
  let index = 0;

  for (let y = minY; y + panelDY <= maxY + 1e-12; y += stepY) {
    for (let x = minX; x + panelDX <= maxX + 1e-12; x += stepX) {
      const panel = turf.polygon(
        [
          [
            [x, y],
            [x + panelDX, y],
            [x + panelDX, y + panelDY],
            [x, y + panelDY],
            [x, y],
          ],
        ],
        { index },
      ) as PanelFeature;

      // Accept only panels fully within the inset polygon.
      if (turf.booleanWithin(panel, inset)) {
        alignedPanels.push(panel);
        index++;
      }
    }
  }

  // Step 4: rotate panels back into geographic coordinates.
  const panels: PanelFeature[] = alignedPanels.map((p) =>
    turf.transformRotate(p, bearing, { pivot }) as PanelFeature,
  );

  return {
    panels,
    count: panels.length,
    totalKwp: (panels.length * opts.panelWattPeak) / 1000,
    panelDimensions: { width: opts.panelWidthM, height: opts.panelHeightM },
    rotationDeg: bearing,
  };
}

function emptyLayout(opts: Required<PanelGridOptions>): PanelLayout {
  return {
    panels: [],
    count: 0,
    totalKwp: 0,
    panelDimensions: { width: opts.panelWidthM, height: opts.panelHeightM },
    rotationDeg: 0,
  };
}

/**
 * Convert a list of panels into a single FeatureCollection,
 * which is what mapbox-gl wants for a single source update.
 */
export function panelsToFeatureCollection(panels: PanelFeature[]) {
  return {
    type: 'FeatureCollection' as const,
    features: panels,
  };
}

/**
 * Estimate yearly yield in kWh given orientation (Bonus task).
 * Simple PVGIS-derived heuristic for Germany; good enough for a quote sheet.
 */
export function estimateYearlyKwh(
  totalKwp: number,
  tiltDeg: number,
  azimuthDeg: number,
): number {
  // Best yield (DE): ~1000 kWh/kWp at 35° tilt and 180° azimuth (south).
  // Penalise deviation in tilt and azimuth using a smooth cosine model.
  const baseKwhPerKwp = 1000;
  const tiltPenalty = Math.cos(((tiltDeg - 35) * Math.PI) / 180);
  // Azimuth penalty: optimum is south. Convert 0/360 (N) → highest penalty.
  const azDelta = Math.abs(((azimuthDeg - 180 + 540) % 360) - 180);
  const azPenalty = Math.cos((azDelta * Math.PI) / 180);
  const factor = Math.max(0.4, tiltPenalty) * Math.max(0.5, azPenalty);
  return Math.round(totalKwp * baseKwhPerKwp * factor);
}
