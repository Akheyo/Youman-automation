/**
 * Panel grid placement on roof segments.
 *
 * Algorithm:
 *   1. Rotate the roof segment polygon so the longest edge aligns with X.
 *   2. Inset (buffer with negative radius) by `setbackM` for the edge margin.
 *   3. Walk a width × height grid in the rotated frame.
 *   4. Keep panels fully inside the inset polygon.
 *   5. Rotate panels back to geographic coordinates.
 *
 * Constants validated against reference pv-konfigurator.html and
 * field-tested in NRW (panel size 1.7m × 1.1m, 0.5m setback,
 * 5cm gap for clamps).
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { PanelFeature, PanelLayout } from '@/types';
import { longestEdgeBearing } from './geo';

export interface PanelGridOptions {
  panelWidthM?: number;
  panelHeightM?: number;
  setbackM?: number;
  gapM?: number;
  panelWattPeak?: number;
  /** Stable id of the source segment so multiple grids can be merged later. */
  segmentId?: string;
}

const DEFAULTS = {
  panelWidthM: 1.7,
  panelHeightM: 1.1,
  setbackM: 0.5,
  gapM: 0.05,
  panelWattPeak: 400,
  segmentId: 'manual',
} satisfies Required<PanelGridOptions>;

export function fitPanels(
  polygon: Feature<Polygon>,
  options: PanelGridOptions = {},
): PanelLayout {
  const opts = { ...DEFAULTS, ...options };
  const ring = polygon.geometry.coordinates[0];
  if (!ring || ring.length < 4) return emptyLayout(opts);

  const bearing = longestEdgeBearing(ring);
  const pivot = turf.centroid(polygon);

  const aligned = turf.transformRotate(polygon, -bearing, { pivot }) as Feature<Polygon>;

  const insetPoly =
    opts.setbackM > 0
      ? (turf.buffer(aligned, -opts.setbackM / 1000, { units: 'kilometers' }) as Feature<Polygon> | undefined)
      : aligned;
  if (!insetPoly || !insetPoly.geometry || insetPoly.geometry.coordinates.length === 0) {
    return emptyLayout(opts);
  }

  const bbox = turf.bbox(insetPoly);
  const minX = bbox[0];
  const minY = bbox[1];
  const maxX = bbox[2];
  const maxY = bbox[3];
  if (minX === undefined || minY === undefined || maxX === undefined || maxY === undefined) {
    return emptyLayout(opts);
  }

  const sw = turf.point([minX, minY]);
  const stepXEnd = turf.destination(sw, (opts.panelWidthM + opts.gapM) / 1000, 90, { units: 'kilometers' });
  const stepYEnd = turf.destination(sw, (opts.panelHeightM + opts.gapM) / 1000, 0, { units: 'kilometers' });
  const stepX = (stepXEnd.geometry.coordinates[0] as number) - minX;
  const stepY = (stepYEnd.geometry.coordinates[1] as number) - minY;

  const panelXEnd = turf.destination(sw, opts.panelWidthM / 1000, 90, { units: 'kilometers' });
  const panelYEnd = turf.destination(sw, opts.panelHeightM / 1000, 0, { units: 'kilometers' });
  const panelDX = (panelXEnd.geometry.coordinates[0] as number) - minX;
  const panelDY = (panelYEnd.geometry.coordinates[1] as number) - minY;

  const aligned_panels: PanelFeature[] = [];
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
        { index, segmentId: opts.segmentId },
      ) as PanelFeature;
      if (turf.booleanWithin(panel, insetPoly)) {
        aligned_panels.push(panel);
        index++;
      }
    }
  }

  const panels: PanelFeature[] = aligned_panels.map(
    (p) => turf.transformRotate(p, bearing, { pivot }) as PanelFeature,
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

export function panelsToFeatureCollection(panels: PanelFeature[]) {
  return {
    type: 'FeatureCollection' as const,
    features: panels,
  };
}

/**
 * Local heuristic for yearly yield (kWh) given orientation. Used only when
 * PVGIS is unreachable (graceful degradation).
 *
 * Reference: 1000 kWh/kWp at 35° tilt, 180° azimuth (south) in Germany.
 */
export function estimateYearlyKwh(totalKwp: number, tiltDeg: number, azimuthDeg: number): number {
  const baseKwhPerKwp = 1000;
  const tiltPenalty = Math.cos(((tiltDeg - 35) * Math.PI) / 180);
  const azDelta = Math.abs(((azimuthDeg - 180 + 540) % 360) - 180);
  const azPenalty = Math.cos((azDelta * Math.PI) / 180);
  const factor = Math.max(0.4, tiltPenalty) * Math.max(0.5, azPenalty);
  return Math.round(totalKwp * baseKwhPerKwp * factor);
}
