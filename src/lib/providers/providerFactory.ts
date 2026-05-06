/**
 * Wählt eine Provider-Kette für RoofDetection.
 *
 * Standard-Reihenfolge (Auto-Modus):
 *   1. Google Solar API – beste Solar-Stats und Panel-Layouts (wenn Key gesetzt).
 *   2. OSM Overpass     – echter Footprint des Gebäudes, immer verfügbar.
 *   3. Mock             – Fallback mit generischen Walmdach-/Satteldach-Templates.
 *
 * LoD2 ist optional und wird nur aktiv, wenn eine konkrete `Lod2DataSource`
 * eingehängt wird (siehe lod2RoofProvider.ts). Der ProviderFactory selbst
 * weiß nichts von einzelnen LoD2-Quellen – er konsumiert nur das Interface.
 */

import type { RoofDetectionProvider } from "./roofDetectionProvider";
import { MockRoofDetectionProvider } from "./mockRoofDetectionProvider";
import { GoogleSolarRoofProvider } from "./googleSolarRoofProvider";
import { OSMRoofProvider } from "./osmRoofProvider";
import {
  Lod2RoofProvider,
  type Lod2DataSource,
} from "./lod2RoofProvider";

export type ProviderOverride =
  | "auto"
  | "mock"
  | "google-solar"
  | "osm"
  | "lod2";

export type ProviderChain = {
  /** Reihenfolge, in der versucht wird zu detektieren. */
  providers: RoofDetectionProvider[];
  /** Menschlich lesbare Begründung der Auswahl. */
  reason: string;
};

/**
 * Optionaler Hook, um zur Laufzeit eine LoD2-Quelle zu registrieren
 * (z. B. für Tests oder regionale CityGML-Pipelines). Wird vom Factory
 * gelesen, sobald eine LoD2-Source verfügbar ist.
 */
let lod2Source: Lod2DataSource | null = null;
export function registerLod2Source(source: Lod2DataSource | null) {
  lod2Source = source;
}

export function selectProviderChain(
  override: ProviderOverride = "auto",
): ProviderChain {
  const googleKey = process.env.GOOGLE_SOLAR_API_KEY;
  const mock = new MockRoofDetectionProvider();
  const osm = new OSMRoofProvider();
  const lod2 = new Lod2RoofProvider(lod2Source);
  const google = googleKey ? new GoogleSolarRoofProvider(googleKey) : null;

  if (override === "mock") {
    return { providers: [mock], reason: "Override: mock." };
  }
  if (override === "osm") {
    return {
      providers: [osm, mock],
      reason: "Override: OSM Overpass, Fallback Mock.",
    };
  }
  if (override === "lod2") {
    if (!lod2Source) {
      return {
        providers: [osm, mock],
        reason:
          "Override LoD2 angefragt, aber keine Datenquelle registriert – nutze OSM, dann Mock.",
      };
    }
    return {
      providers: [lod2, osm, mock],
      reason: "Override: LoD2, Fallback OSM/Mock.",
    };
  }
  if (override === "google-solar") {
    if (!google) {
      return {
        providers: [osm, mock],
        reason:
          "Override Google Solar angefragt, aber kein API-Key – nutze OSM, dann Mock.",
      };
    }
    return {
      providers: [google, osm, mock],
      reason: "Override: Google Solar, Fallback OSM/Mock.",
    };
  }

  // auto – Standardkette
  const chain: RoofDetectionProvider[] = [];
  const reasons: string[] = [];
  if (lod2Source) {
    chain.push(lod2);
    reasons.push("LoD2 (registriert)");
  }
  if (google) {
    chain.push(google);
    reasons.push("Google Solar API");
  }
  chain.push(osm);
  reasons.push("OSM Overpass");
  chain.push(mock);
  reasons.push("Mock");

  return {
    providers: chain,
    reason: `Kette: ${reasons.join(" → ")}.`,
  };
}

/**
 * Backwards-compat: gibt nur den ersten Provider der Kette zurück.
 * Wird vom api/detect-roof-Endpoint nicht mehr genutzt, hier aber für
 * Aufrufer aus dem alten Pfad belassen.
 */
export function selectRoofDetectionProvider(
  override: ProviderOverride = "auto",
): { provider: RoofDetectionProvider; reason: string } {
  const chain = selectProviderChain(override);
  return { provider: chain.providers[0]!, reason: chain.reason };
}
