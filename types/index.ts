/**
 * Domain types for the A&B PV-Konfigurator.
 *
 * Shared between client components, API routes, and the Vitest test suite.
 */

import type { Feature, Polygon, Position } from 'geojson';

// ---------------------------------------------------------------------------
// Address & geocoding
// ---------------------------------------------------------------------------

export interface AddressResult {
  /** Provider feature id, used as React key. */
  id: string;
  /** Human-readable label shown in the dropdown. */
  placeName: string;
  /** [longitude, latitude]. */
  center: [number, number];
  /** Source provider (mapbox or nominatim). */
  source: 'mapbox' | 'nominatim';
}

// ---------------------------------------------------------------------------
// OSM building footprints
// ---------------------------------------------------------------------------

export interface BuildingFootprint {
  /** OSM way/relation id. */
  id: number;
  /** Closed ring of [lng, lat] points. First === last. */
  coordinates: Position[];
  /** Optional building height in meters (parsed from OSM tags). */
  height?: number;
  /** Raw OSM tags (debugging / advanced use). */
  tags?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// NRW LANUK Solarkataster (sk_dachflaechen)
// ---------------------------------------------------------------------------

export type RoofSuitability = 'sehr gut' | 'gut' | 'bedingt' | 'ungeeignet';

export interface NrwRoofSegment {
  /** WFS feature id (gml:id or stable hash). */
  id: string;
  /** GeoJSON polygon of the roof segment. */
  polygon: Feature<Polygon>;
  /** Compass azimuth where the roof faces. 0=N, 90=E, 180=S, 270=W. */
  azimuthDeg: number;
  /** Roof pitch in degrees (0=flat, 30°=typical residential). */
  pitchDeg: number;
  /** Suitability classification (LANUK). */
  suitability: RoofSuitability;
  /** Yearly yield estimate in kWh from the cadastre (already accounts for shading). */
  yieldKwh: number;
  /** Module count estimate from the cadastre. */
  moduleCount: number;
  /** Suitable area in m² from the cadastre. */
  areaM2: number;
}

// ---------------------------------------------------------------------------
// Panel layout
// ---------------------------------------------------------------------------

export type PanelFeature = Feature<Polygon, { index: number; segmentId: string }>;

export interface PanelLayout {
  panels: PanelFeature[];
  count: number;
  /** Watt-peak installed capacity. */
  totalKwp: number;
  /** Per-panel size in meters used for the calculation. */
  panelDimensions: { width: number; height: number };
  /** Rotation in degrees applied to align panels with the segment's longest edge. */
  rotationDeg: number;
}

// ---------------------------------------------------------------------------
// Consumption & add-ons
// ---------------------------------------------------------------------------

export interface AddOns {
  /** Battery storage (Stromspeicher). +€8000, raises self-consumption ratio to 70%. */
  storage: boolean;
  /** Wallbox for EV charging. +€1500, +3000 kWh consumption. */
  wallbox: boolean;
  /** Heat pump (Wärmepumpe). No PV cost surcharge, +4500 kWh consumption. */
  heatpump: boolean;
}

export interface Consumption {
  /** Annual consumption in kWh. */
  kwhYear: number;
  /** Electricity price in cents per kWh. */
  priceCtKwh: number;
  /** Whether the customer already drives an electric vehicle (informational). */
  hasEAuto: boolean;
  addons: AddOns;
}

// ---------------------------------------------------------------------------
// PV calculation result
// ---------------------------------------------------------------------------

export interface PVCalculation {
  /** Recommended system size in kWp. */
  recommendedKwp: number;
  /** Number of modules at 400 Wp each. */
  moduleCount: number;
  /** Yearly yield in kWh. */
  yearlyYieldKwh: number;
  /** Self-consumption (Eigenverbrauch) in kWh/year. */
  selfConsumptionKwh: number;
  /** Self-consumption ratio (Eigenverbrauchsquote, 0–1). */
  selfConsumptionRatio: number;
  /** Grid feed-in (Einspeisung) in kWh/year. */
  feedInKwh: number;
  /** Annual savings in EUR. */
  yearlySavingsEur: number;
  /** Investment in EUR. */
  investmentEur: number;
  /** Payback period (Amortisation) in years. */
  paybackYears: number;
  /** CO₂ savings in metric tonnes per year. */
  co2SavingsT: number;
  /** Equivalent number of trees. */
  treesEquivalent: number;
  /** ROI projection over 5/10/15/20 years. */
  roiProjection: ROIProjection[];
}

export interface ROIProjection {
  yearsHorizon: number;
  /** Cumulative cost without PV in EUR. */
  costNoPV: number;
  /** Cumulative cost with PV (including investment) in EUR. */
  costWithPV: number;
}

// ---------------------------------------------------------------------------
// PVGIS
// ---------------------------------------------------------------------------

export interface PVGISResult {
  /** Yearly energy E_y in kWh. */
  yearlyKwh: number;
  /** Monthly energy in kWh, indexed 1..12. */
  monthlyKwh: number[];
  /** Optimal tilt angle suggested by PVGIS. */
  optimalTiltDeg?: number;
}

// ---------------------------------------------------------------------------
// Lead form
// ---------------------------------------------------------------------------

export interface LeadPayload {
  name: string;
  phone: string;
  email: string;
  /** "sofort" | "1-3-monate" | "3-6-monate" | "spaeter". */
  timeframe: string;
  message?: string;
  address: string;
  lat: number;
  lng: number;
  consumption: Consumption;
  calculation: Pick<
    PVCalculation,
    'recommendedKwp' | 'moduleCount' | 'yearlyYieldKwh' | 'yearlySavingsEur' | 'investmentEur' | 'paybackYears' | 'co2SavingsT'
  >;
  /** ISO 8601. */
  timestamp: string;
  /** DSGVO consent given (must be true). */
  consent: true;
  /** Free-form provenance (e.g. "iframe@ab-solarenergy.de", "standalone"). */
  source: string;
}
