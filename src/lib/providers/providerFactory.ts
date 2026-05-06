/**
 * Wählt den passenden RoofDetectionProvider abhängig von verfügbaren
 * Umgebungsvariablen / Optionen.
 *
 * Priorität:
 *   1. GoogleSolarRoofProvider, wenn GOOGLE_SOLAR_API_KEY gesetzt ist
 *      (und der Aufrufer nicht explizit auf "mock" zwingt).
 *   2. MockRoofDetectionProvider sonst.
 *   3. Lod2RoofProvider noch nicht aktiv (Stub, siehe lod2/README.md).
 */

import type { RoofDetectionProvider } from "./roofDetectionProvider";
import { MockRoofDetectionProvider } from "./mockRoofDetectionProvider";
import { GoogleSolarRoofProvider } from "./googleSolarRoofProvider";

export type ProviderOverride = "auto" | "mock" | "google-solar" | "lod2";

export type ProviderSelection = {
  provider: RoofDetectionProvider;
  reason: string;
};

export function selectRoofDetectionProvider(
  override: ProviderOverride = "auto",
): ProviderSelection {
  const googleKey = process.env.GOOGLE_SOLAR_API_KEY;

  if (override === "mock") {
    return {
      provider: new MockRoofDetectionProvider(),
      reason: "Override: mock",
    };
  }

  if (override === "lod2") {
    // Lod2 ist ein Stub, fällt im Moment auf Mock zurück.
    return {
      provider: new MockRoofDetectionProvider(),
      reason: "Lod2-Provider ist noch nicht implementiert. Fallback auf Mock.",
    };
  }

  if (override === "google-solar" || (override === "auto" && googleKey)) {
    if (!googleKey) {
      return {
        provider: new MockRoofDetectionProvider(),
        reason:
          "GOOGLE_SOLAR_API_KEY fehlt – Fallback auf MockRoofDetectionProvider.",
      };
    }
    return {
      provider: new GoogleSolarRoofProvider(googleKey),
      reason: "GOOGLE_SOLAR_API_KEY gesetzt – nutze Google Solar API.",
    };
  }

  return {
    provider: new MockRoofDetectionProvider(),
    reason: "Kein API-Key – nutze MockRoofDetectionProvider.",
  };
}
