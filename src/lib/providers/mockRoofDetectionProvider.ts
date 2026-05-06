/**
 * MockRoofDetectionProvider
 *
 * Liefert ein realistisches DetectedBuilding mit echten 3D-Vertices für
 * Dachflächen. Wählt anhand der eingegebenen Adresse / Koordinate oder
 * eines optionalen Hinweises einen der Mock-Templates aus, damit die App
 * auch ohne API-Keys verschiedene Gebäudetypen demonstrieren kann.
 */

import type {
  BuildingFootprint,
  DetectedBuilding,
  RoofFace,
} from "@/types/solar";
import {
  buildMockFootprint,
  buildMockRoofFaces,
  MOCK_TEMPLATES,
  type MockBuildingKind,
} from "@/lib/geometry/mockRoofs";
import { localMetersToLngLat } from "@/lib/geometry/coordinates";
import type {
  RoofDetectionInput,
  RoofDetectionProvider,
} from "./roofDetectionProvider";

const KIND_ORDER: MockBuildingKind[] = [
  "satteldach",
  "walmdach",
  "flachdach",
  "pultdach",
  "komplex",
];

/**
 * Hash-basierte Auswahl eines Templates, damit die gleiche Adresse / Lat-Lng
 * stets dasselbe Gebäude liefert (Reproduzierbarkeit).
 */
function pickKindFromInput(input: RoofDetectionInput): MockBuildingKind {
  const seed = `${input.address ?? ""}|${input.lat.toFixed(4)}|${input.lng.toFixed(4)}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % KIND_ORDER.length;
  return KIND_ORDER[idx]!;
}

export class MockRoofDetectionProvider implements RoofDetectionProvider {
  readonly name = "mock";

  constructor(private readonly forceKind?: MockBuildingKind) {}

  async detectRoof(input: RoofDetectionInput): Promise<DetectedBuilding> {
    const kind = this.forceKind ?? pickKindFromInput(input);
    const template = MOCK_TEMPLATES[kind];
    const roofFaces: RoofFace[] = buildMockRoofFaces(template);
    const footprintLocal = buildMockFootprint(template);

    const footprint: BuildingFootprint = {
      vertices: footprintLocal.map((p) =>
        localMetersToLngLat(p.x, p.y, input.lng, input.lat),
      ),
    };

    const totalRoofAreaM2 = roofFaces.reduce((s, f) => s + f.areaM2, 0);
    const selectedRoofAreaM2 = roofFaces
      .filter((f) => f.selected)
      .reduce((s, f) => s + f.areaM2, 0);

    return {
      buildingId: `mock-${kind}-${Date.now()}`,
      address: input.address,
      center: { lng: input.lng, lat: input.lat },
      footprint,
      roofFaces,
      modules: [],
      source: "mock",
      confidence: 1.0,
      metrics: {
        totalRoofAreaM2,
        selectedRoofAreaM2,
        moduleCount: 0,
        totalKwp: 0,
      },
      warnings: [
        `Demo-Daten (${template.label}). Keine echten Vermessungsdaten.`,
      ],
    };
  }
}

export function getAvailableMockKinds(): MockBuildingKind[] {
  return [...KIND_ORDER];
}
