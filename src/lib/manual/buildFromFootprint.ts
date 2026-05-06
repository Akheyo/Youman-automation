/**
 * Manuelles Bauen eines DetectedBuilding aus einem vom User auf der Karte
 * gezeichneten Footprint.
 *
 * Nimmt:
 *   - Liste der angeklickten lng/lat-Eckpunkte (Polygon-Außenring)
 *   - Dachform (Sattel/Walm/Flach/Pult)
 *   - Pitch in Grad
 *   - Traufhöhe in Metern
 *
 * Berechnet:
 *   - Oriented Bounding Box → Hauptachse, halfWidth/halfLength
 *   - Daraus First-Höhe (eave + halfWidth × tan(pitch))
 *   - Mock-Builder erzeugt RoofFaces mit echten 3D-Vertices
 *
 * Footprint wird 1:1 als Wand-Polygon übernommen (echter User-Outline);
 * das Dach sitzt auf einem rechteckigen Envelope, das die OBB abdeckt.
 *
 * Source: "manual", Confidence 1.0 (User hat selbst gezeichnet).
 */

import type {
  BuildingFootprint,
  DetectedBuilding,
  LngLat,
  RoofFace,
} from "@/types/solar";
import {
  buildMockRoofFaces,
  type MockBuildingTemplate,
} from "@/lib/geometry/mockRoofs";
import {
  fitOrientedBox,
  type RoofShape,
} from "@/lib/geometry/roofShapeHeuristic";

const DEG = Math.PI / 180;

export type ManualBuildingParams = {
  footprint: LngLat[];
  shape: RoofShape;
  /** Dachneigung in Grad. Bei Flachdach ignoriert. */
  pitchDeg: number;
  /** Wandhöhe in Metern (Traufe). */
  eaveHeightM: number;
  /** Optionaler Label-Text für den Building-State. */
  label?: string;
  /** Optional: explizite First-Richtung in Grad (Azimuth, 0 = Nord, CW). */
  ridgeAzimuthDeg?: number;
};

export function buildBuildingFromManualFootprint(
  p: ManualBuildingParams,
): DetectedBuilding {
  if (p.footprint.length < 3) {
    throw new Error("Footprint braucht mindestens 3 Eckpunkte.");
  }

  const obb = fitOrientedBox(p.footprint);
  // Wenn der User die First-Linie explizit angegeben hat, nutzen wir
  // dieses Azimuth statt der OBB-Heuristik. Die OBB-Maße bleiben gleich,
  // nur die Rotation der Default-Geometrie passt sich der echten First an.
  const ridgeAzimuthDeg =
    p.ridgeAzimuthDeg !== undefined
      ? p.ridgeAzimuthDeg
      : obb.ridgeAzimuthDeg;

  const rise =
    p.shape === "flachdach"
      ? 0
      : obb.halfWidthM * Math.tan(p.pitchDeg * DEG);
  const ridgeHeightM = p.eaveHeightM + rise;
  // mockRoofs.buildXxx nutzt rotationDeg als CCW-Rotation der Default-Geometrie
  // (First entlang Y-Achse). Wir drehen den First in Richtung des bestimmten
  // Azimuths (User oder OBB) → rotationDeg = -ridgeAzimuthDeg.
  const rotationDeg = -ridgeAzimuthDeg;

  const template: MockBuildingTemplate = {
    kind: p.shape,
    label: p.label ?? "Manuell gezeichnet",
    halfWidthM: obb.halfWidthM,
    halfLengthM: obb.halfLengthM,
    eaveHeightM: p.eaveHeightM,
    ridgeHeightM,
    rotationDeg,
  };

  if (p.shape === "walmdach") {
    // Walm-Anteil ~20 % der Hauslänge an jeder Seite, also First = 60 % der Länge.
    template.ridgeLengthM = obb.halfLengthM * 2 * 0.6;
  }

  const rawRoofFaces = buildMockRoofFaces(template);

  const roofFaces: RoofFace[] = rawRoofFaces.map((f) => ({
    ...f,
    source: "manual",
    confidence: 1.0,
    metadata: {
      ...f.metadata,
      manualShape: p.shape,
      manualPitchDeg: p.pitchDeg,
      manualEaveHeightM: p.eaveHeightM,
    },
  }));

  const footprint: BuildingFootprint = { vertices: p.footprint };

  const totalRoofAreaM2 = roofFaces.reduce((s, f) => s + f.areaM2, 0);
  const selectedRoofAreaM2 = roofFaces
    .filter((f) => f.selected)
    .reduce((s, f) => s + f.areaM2, 0);

  return {
    buildingId: `manual-${Date.now()}`,
    center: { lng: obb.centerLng, lat: obb.centerLat },
    footprint,
    roofFaces,
    modules: [],
    source: "manual",
    confidence: 1.0,
    metrics: {
      totalRoofAreaM2,
      selectedRoofAreaM2,
      moduleCount: 0,
      totalKwp: 0,
    },
    warnings: [
      "Vom User gezeichneter Footprint. Dachgeometrie aus Form/Pitch/Traufhöhe abgeleitet.",
    ],
  };
}
