import type { Feature, Polygon, Position } from 'geojson';

/** Result returned by the geocoding endpoint. */
export interface AddressResult {
  /** Mapbox feature id, used as React key. */
  id: string;
  /** Human-readable label shown in the dropdown. */
  placeName: string;
  /** [longitude, latitude]. */
  center: [number, number];
}

/** OSM building footprint normalised for our use. */
export interface BuildingFootprint {
  /** OSM way/relation id. */
  id: number;
  /** Closed ring of [lng, lat] points. First === last. */
  coordinates: Position[];
  /** Optional building height in meters (from OSM tags). */
  height?: number;
  /** Raw OSM tags for debugging / advanced use. */
  tags?: Record<string, string>;
}

/** A single solar panel rectangle in geographic coordinates. */
export type PanelFeature = Feature<Polygon, { index: number }>;

/** Result of fitting panels into a polygon. */
export interface PanelLayout {
  panels: PanelFeature[];
  count: number;
  /** Watt-peak installed capacity. */
  totalKwp: number;
  /** Per-panel size in meters used for the calculation. */
  panelDimensions: { width: number; height: number };
  /** Rotation in degrees applied to align panels with the building's longest edge. */
  rotationDeg: number;
}

/** Optional tilt + azimuth used for energy yield estimation (Bonus). */
export interface RoofOrientation {
  /** 0–90, where 0 = flat, 35 = typical residential pitch. */
  tiltDeg: number;
  /** Compass azimuth where the roof faces. 0 = N, 90 = E, 180 = S, 270 = W. */
  azimuthDeg: number;
}

/** Final aggregate the UI consumes. */
export interface PVResult {
  address: AddressResult;
  building: BuildingFootprint;
  buildingPolygon: Feature<Polygon>;
  areaM2: number;
  layout: PanelLayout;
  orientation?: RoofOrientation;
  /** Estimated yearly yield in kWh (only when orientation provided). */
  estimatedYearlyKwh?: number;
}
