/**
 * OSMRoofProvider
 *
 * Nutzt OpenStreetMap (Overpass API) für reale Gebäude-Footprints und
 * leitet darauf eine Dachgeometrie ab, die auf die Maße des echten
 * Gebäudes passt – statt die generischen 10×20 m-Mock-Templates.
 *
 * Pipeline:
 *   1. Overpass: Gebäude im Radius 40 m um (lat, lng).
 *   2. Closest Match: Building, dessen Centroid am nächsten an der Anfrage
 *      liegt (mit Mindest-Größe 15 m², um Mülltonnen/Gartenhäuser rauszuwerfen).
 *   3. Real-Footprint übernehmen → wird im NativeBuildingLayer als
 *      fill-extrusion-Wand 1:1 gerendert (echte Hausform).
 *   4. OBB + Heuristik (oder OSM-Tags) → Dachform raten.
 *   5. MockRoofs-Builder mit den OBB-Maßen aufrufen → RoofFaces auf dem
 *      OBB-Rechteck. Roof sitzt also auf einem Dachenvelope, das sich
 *      nach den realen Außenkanten richtet.
 *   6. Source-Marker auf "osm" setzen.
 *
 * Bekannte Grenzen (Trade-offs):
 *   - L-/T-förmige Gebäude bekommen ein rechteckiges Dach-Envelope auf einem
 *     komplexen Wand-Footprint. Die Wände passen, das Dach ist eine
 *     Approximation. Echte L-Dächer kommen erst mit LoD2.
 *   - Höhe wird aus `building:levels` oder `height`-Tag geschätzt.
 *   - Pitch standardmäßig 35°, sofern OSM keinen `roof:angle` liefert.
 */

import type {
  BuildingFootprint,
  DetectedBuilding,
  LngLat,
  RoofFace,
} from "@/types/solar";
import { lngLatToLocalMeters } from "@/lib/geometry/coordinates";
import {
  buildMockRoofFaces,
  type MockBuildingTemplate,
} from "@/lib/geometry/mockRoofs";
import {
  fitOrientedBox,
  guessRoofShape,
  parseBuildingHeightM,
  parseRoofPitchDeg,
} from "@/lib/geometry/roofShapeHeuristic";
import { fetchBuildingsNear, type OsmBuilding } from "@/lib/api/overpass";
import type {
  RoofDetectionInput,
  RoofDetectionProvider,
} from "./roofDetectionProvider";

const DEG = Math.PI / 180;

export class OSMRoofProvider implements RoofDetectionProvider {
  readonly name = "osm";

  async detectRoof(input: RoofDetectionInput): Promise<DetectedBuilding> {
    // Erst 80 m, dann 150 m versuchen – beim Klicken in der 3D-Tilt-Ansicht
    // landet der Klickpunkt durch die Perspektive 8–15 m neben dem Haus,
    // ländliche Gebiete sind in OSM zudem oft lückenhaft.
    let buildings = await fetchBuildingsNear(input.lat, input.lng, 80);
    if (buildings.length === 0) {
      buildings = await fetchBuildingsNear(input.lat, input.lng, 150);
    }
    if (buildings.length === 0) {
      throw new Error(
        "OSM hat keine Gebäude in der Nähe der Adresse gefunden.",
      );
    }

    const target = pickClosestBuilding(buildings, input.lat, input.lng);
    if (!target) {
      throw new Error("OSM: kein passendes Gebäude in der Nähe.");
    }

    /* --------- Footprint übernehmen (Geometrie schließen, falls nötig) --------- */
    const footprintLngLat: LngLat[] = target.geometry
      .map((g) => ({ lng: g.lng, lat: g.lat }))
      // OSM ways enden oft mit dem gleichen Knoten wie sie anfangen; den
      // doppelten Endpunkt entfernen wir, damit unsere downstream-Logik
      // (Fläche, Modulplatzierung) nicht durcheinanderkommt.
      .filter((p, i, arr) => {
        if (i === 0) return true;
        const prev = arr[i - 1]!;
        return p.lng !== prev.lng || p.lat !== prev.lat;
      });
    const footprint: BuildingFootprint = { vertices: footprintLngLat };

    /* --------- OBB + Höhen + Dachform --------- */
    const obb = fitOrientedBox(footprintLngLat);
    const heightInfo = parseBuildingHeightM(target.tags);
    const pitchOsm = parseRoofPitchDeg(target.tags);
    const guess = guessRoofShape(footprintLngLat, obb, target.tags);

    // Pitch fixieren (Default 35°) und daraus rise berechnen, damit der
    // First passend zur echten Gebäudebreite sitzt.
    const pitchDeg = pitchOsm ?? 35;
    const rise = obb.halfWidthM * Math.tan(pitchDeg * DEG);
    const eaveHeightM = Math.max(0.7 * heightInfo.totalM, heightInfo.totalM - rise);
    const ridgeHeightM = guess.shape === "flachdach"
      ? eaveHeightM
      : eaveHeightM + rise;

    /* --------- Mock-Template aus realen Maßen ableiten --------- */
    // Konvention in mockRoofs.ts: `rotationDeg` ist CCW-Rotation um Z, die auf
    // die Default-Geometrie (First entlang Y) angewendet wird. Wir wollen,
    // dass der First nach `obb.ridgeAzimuthDeg` zeigt (CW von Nord). Daraus:
    // rotationDeg = -ridgeAzimuthDeg.
    const rotationDeg = -obb.ridgeAzimuthDeg;

    const template: MockBuildingTemplate = {
      kind: guess.shape,
      label: target.tags["addr:street"]
        ? `OSM: ${target.tags["addr:street"]} ${target.tags["addr:housenumber"] ?? ""}`.trim()
        : `OSM-Gebäude #${target.id}`,
      halfWidthM: obb.halfWidthM,
      halfLengthM: obb.halfLengthM,
      eaveHeightM,
      ridgeHeightM,
      rotationDeg,
    };

    if (guess.shape === "walmdach") {
      // Walm-Anteil moderat halten: ridgeLength = 60 % der Gesamtlänge.
      template.ridgeLengthM = obb.halfLengthM * 2 * 0.6;
    }

    /* --------- RoofFaces über existierenden Mock-Builder --------- */
    // Die Geometrie ist relativ zum OBB-Centroid. Da wir den Centroid als
    // Building-Center verwenden, passt das 1:1.
    const rawRoofFaces = buildMockRoofFaces(template);

    const roofFaces: RoofFace[] = rawRoofFaces.map((f) => ({
      ...f,
      source: "osm",
      confidence: 0.7,
      metadata: {
        ...f.metadata,
        roofShapeGuess: guess.shape,
        roofShapeReason: guess.reason,
        heightSource: heightInfo.source,
        approximation: true,
      },
    }));

    /* --------- DetectedBuilding zusammensetzen --------- */
    const totalRoofAreaM2 = roofFaces.reduce((s, f) => s + f.areaM2, 0);
    const selectedRoofAreaM2 = roofFaces
      .filter((f) => f.selected)
      .reduce((s, f) => s + f.areaM2, 0);

    const warnings = [
      `Gebäude aus OSM: ${guess.reason}`,
      `Gebäudehöhe: ${heightInfo.totalM.toFixed(1)} m (Quelle: ${heightInfo.source}).`,
      "Dachflächen wurden aus dem realen Footprint approximiert. Für amtlich vermessene Geometrie LoD2-Daten nutzen.",
    ];

    return {
      buildingId: `osm-${target.id}`,
      address: input.address,
      center: { lng: obb.centerLng, lat: obb.centerLat },
      footprint,
      roofFaces,
      modules: [],
      source: "osm",
      confidence: pitchOsm ? 0.75 : 0.65,
      metrics: {
        totalRoofAreaM2,
        selectedRoofAreaM2,
        moduleCount: 0,
        totalKwp: 0,
      },
      warnings,
    };
  }
}

/* ----------------------------- Helpers ----------------------------- */

function pickClosestBuilding(
  buildings: OsmBuilding[],
  lat: number,
  lng: number,
): OsmBuilding | null {
  let best: { b: OsmBuilding; d: number } | null = null;
  for (const b of buildings) {
    const c = polygonCentroid(b.geometry);
    const dx =
      (c.lng - lng) *
      111320 *
      Math.cos((lat * Math.PI) / 180);
    const dy = (c.lat - lat) * 111320;
    const d = Math.hypot(dx, dy);
    // Mindestgröße der Bounding-Box als Schwelle für „kein Schuppen/Tonne".
    // 5 m² Schwelle: filtert Mülltonnen/Briefkästen, lässt aber kleine
    // Wohnhäuser/Garagen rein (typisch 30–60 m²).
    const sizeOk = approximateAreaM2(b.geometry, lat) > 5;
    if (!sizeOk) continue;
    if (!best || d < best.d) best = { b, d };
  }
  return best ? best.b : null;
}

function polygonCentroid(pts: { lat: number; lng: number }[]): {
  lat: number;
  lng: number;
} {
  let lat = 0;
  let lng = 0;
  for (const p of pts) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

function approximateAreaM2(
  pts: { lat: number; lng: number }[],
  refLat: number,
): number {
  if (pts.length < 3) return 0;
  // Project to local meters around refLat.
  const local = pts.map((p) =>
    lngLatToLocalMeters(p.lng, p.lat, pts[0]!.lng, refLat),
  );
  let area2 = 0;
  for (let i = 0; i < local.length; i++) {
    const a = local[i]!;
    const b = local[(i + 1) % local.length]!;
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2) / 2;
}
