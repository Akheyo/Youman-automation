/**
 * Zentrale TypeScript-Typen für den 3D-Solarplaner.
 *
 * Wichtig: Die Visualisierung kennt keine Dachtypen wie "Satteldach" oder
 * "Walmdach" – sie arbeitet ausschließlich mit `RoofFace`-Objekten.
 * Alle Datenquellen (Mock, Google Solar API, LoD2) müssen ihre Ergebnisse
 * in dieses einheitliche Datenmodell normalisieren.
 */

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type LngLat = {
  lng: number;
  lat: number;
};

export type DataSource =
  | "mock"
  | "google-solar"
  | "lod2"
  | "osm"
  | "vision"
  | "manual";

/**
 * Eine einzelne Dachfläche im Gebäude. `vertices3d` sind lokale
 * Meterkoordinaten relativ zum Gebäudezentrum (X = Ost, Y = Nord, Z = Höhe).
 */
export type RoofFace = {
  id: string;
  label: string;
  vertices3d: Vec3[];
  centerLngLat?: LngLat;
  pitchDeg: number;
  azimuthDeg: number;
  areaM2: number;
  selected: boolean;
  confidence?: number;
  source: DataSource;
  metadata?: Record<string, unknown>;
};

export type BuildingFootprint = {
  vertices: LngLat[];
};

export type PVModule = {
  id: string;
  roofFaceId: string;
  /** 4 Eckpunkte des Modulrechtecks im lokalen Meter-System. */
  vertices3d: Vec3[];
  wp: number;
};

export type DetectedBuildingMetrics = {
  totalRoofAreaM2: number;
  selectedRoofAreaM2: number;
  moduleCount: number;
  totalKwp: number;
};

export type DetectedBuilding = {
  buildingId: string;
  address?: string;
  center: LngLat;
  footprint?: BuildingFootprint;
  roofFaces: RoofFace[];
  modules: PVModule[];
  source: DataSource;
  confidence?: number;
  metrics: DetectedBuildingMetrics;
  /** Hinweise wie "Dachflächen wurden approximiert" werden hier gesammelt. */
  warnings?: string[];
};

export type ModuleSettings = {
  moduleWp: number;
  moduleWidthM: number;
  moduleLengthM: number;
  edgeMarginM: number;
  moduleGapM: number;
  orientation: "portrait" | "landscape";
};

export type MapSettings = {
  tileUrl?: string;
  tileAttribution?: string;
};

export type DetectRoofRequest =
  | { address: string; lat?: number; lng?: number }
  | { address?: string; lat: number; lng: number };

export type GeocodeResponse = {
  lat: number;
  lng: number;
  formattedAddress: string;
};
