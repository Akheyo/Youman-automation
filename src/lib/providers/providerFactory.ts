/**
 * Wählt eine Provider-Kette für RoofDetection.
 *
 * Standard-Reihenfolge (Auto-Modus):
 *   1. LoD2 (wenn registriert)         – amtliche 3D-Geometrie für DE.
 *   2. Google Solar API (wenn Key)     – beste Solar-Stats und Panel-Layouts.
 *   3. Vision Orientation (wenn Key)   – KI-Analyse des Satellitenbilds.
 *   4. OSM Overpass                    – echter Footprint des Gebäudes.
 *   5. Mock                            – generischer Notnagel.
 *
 * Vision und LoD2 sind optional und werden nur aktiviert, wenn die jeweiligen
 * Voraussetzungen erfüllt sind (ANTHROPIC_API_KEY bzw. registrierte
 * Lod2DataSource).
 */

import type { RoofDetectionProvider } from "./roofDetectionProvider";
import { MockRoofDetectionProvider } from "./mockRoofDetectionProvider";
import { GoogleSolarRoofProvider } from "./googleSolarRoofProvider";
import { OSMRoofProvider } from "./osmRoofProvider";
import { VisionOrientationProvider } from "./visionOrientation";
import {
  Lod2RoofProvider,
  type Lod2DataSource,
} from "./lod2RoofProvider";

export type ProviderOverride =
  | "auto"
  | "mock"
  | "google-solar"
  | "osm"
  | "vision"
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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const mock = new MockRoofDetectionProvider();
  const osm = new OSMRoofProvider();
  const lod2 = new Lod2RoofProvider(lod2Source);
  const google = googleKey ? new GoogleSolarRoofProvider(googleKey) : null;
  const vision = anthropicKey
    ? new VisionOrientationProvider(anthropicKey)
    : null;

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
  if (override === "vision") {
    if (!vision) {
      return {
        providers: [osm, mock],
        reason:
          "Override Vision angefragt, aber ANTHROPIC_API_KEY fehlt – nutze OSM, dann Mock.",
      };
    }
    return {
      providers: [vision, osm, mock],
      reason: "Override: Vision Satellitenbild-Analyse, Fallback OSM/Mock.",
    };
  }

  // auto – Standardkette. Mock liegt am Ende als letzter Notnagel.
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
  if (vision) {
    chain.push(vision);
    reasons.push("Claude Vision (Satellitenbild)");
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
