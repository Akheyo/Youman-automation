/**
 * Provider-Interface für die Dach-Erkennung.
 *
 * Alle Quellen (Mock, Google Solar API, LoD2-Tiles) implementieren dieses
 * Interface und liefern ein normalisiertes `DetectedBuilding` zurück.
 */

import type { DetectedBuilding } from "@/types/solar";

export type RoofDetectionInput = {
  address?: string;
  lat: number;
  lng: number;
};

export interface RoofDetectionProvider {
  readonly name: string;
  detectRoof(input: RoofDetectionInput): Promise<DetectedBuilding>;
}
