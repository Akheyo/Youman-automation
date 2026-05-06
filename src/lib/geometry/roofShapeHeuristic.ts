/**
 * Heuristische Erkennung von Gebäude-Bounding-Box und Dachform.
 *
 * Eingabe: ein lng/lat-Footprint (z. B. von OSM) und optional OSM-Tags.
 * Ausgabe:
 *   - Oriented Bounding Box (OBB): Centroid + halbe Achsen + Firstrichtung
 *   - Geschätzte Dachform (Sattel, Walm, Flach, Pult)
 *
 * Algorithmus für OBB:
 *   Brute-Force-Sampling von Rotationen (1°-Schritten); nimm die mit dem
 *   kleinsten achsparallelen Bounding-Box-Volumen. Für Standard-Wohnhäuser
 *   (rechteckiger Grundriss) ergibt das die korrekte Hauptachse, ohne dass
 *   Rotating-Calipers implementiert werden muss.
 *
 * Algorithmus für Dachform:
 *   1. OSM-Tag `roof:shape` ist autoritativ → wenn vorhanden, mappen.
 *   2. Wenn Footprint > 8 Eckpunkte → komplex/Flach.
 *   3. Aspect Ratio:
 *        > 1.6  → Satteldach (langgezogen)
 *        ≤ 1.25 → Walmdach (eher quadratisch)
 *        sonst  → Satteldach (Default)
 */

import type { LngLat } from "@/types/solar";
import {
  lngLatToLocalMeters,
  rotatePoint2D,
} from "@/lib/geometry/coordinates";

export type OrientedBox = {
  /** Centroid (Mittelwert) des Footprints. */
  centerLng: number;
  centerLat: number;
  /** Halbe Breite (senkrecht zur First-Richtung) in Metern. */
  halfWidthM: number;
  /** Halbe Länge (entlang der First-Richtung) in Metern. */
  halfLengthM: number;
  /** Azimuth der First-Richtung (0° = Nord, 90° = Ost, im Uhrzeigersinn). */
  ridgeAzimuthDeg: number;
};

export type RoofShape = "satteldach" | "walmdach" | "flachdach" | "pultdach";

export type RoofShapeGuess = {
  shape: RoofShape;
  /** 0–1, höher = sicherer. */
  confidence: number;
  reason: string;
};

/** Centroid eines Polygons (einfacher Mittelwert über Vertices). */
function centroid(points: LngLat[]): LngLat {
  let sumLng = 0;
  let sumLat = 0;
  for (const p of points) {
    sumLng += p.lng;
    sumLat += p.lat;
  }
  return {
    lng: sumLng / points.length,
    lat: sumLat / points.length,
  };
}

/**
 * OBB durch Rotations-Sampling (1°-Schritte über [0°, 90°)).
 * Gibt die Box mit minimalem axis-aligned-Bounding-Box-Flächeninhalt zurück.
 */
export function fitOrientedBox(footprint: LngLat[]): OrientedBox {
  if (footprint.length < 3) {
    throw new Error("OBB: Footprint braucht mindestens 3 Vertices");
  }

  const c = centroid(footprint);
  const localPts = footprint.map((p) =>
    lngLatToLocalMeters(p.lng, p.lat, c.lng, c.lat),
  );

  let bestArea = Infinity;
  let bestAngle = 0;
  let bestHalfX = 0;
  let bestHalfY = 0;

  for (let angle = 0; angle < 90; angle++) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of localPts) {
      // CW-Rotation um `angle` Grad.
      const r = rotatePoint2D(p.x, p.y, -angle);
      if (r.x < minX) minX = r.x;
      if (r.x > maxX) maxX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.y > maxY) maxY = r.y;
    }
    const w = maxX - minX;
    const l = maxY - minY;
    const area = w * l;
    if (area < bestArea) {
      bestArea = area;
      bestAngle = angle;
      bestHalfX = w / 2;
      bestHalfY = l / 2;
    }
  }

  // Im rotierten Frame: bestHalfX = halbe X-Ausdehnung, bestHalfY = halbe Y.
  // Längere Achse = First-Richtung.
  let halfWidthM: number;
  let halfLengthM: number;
  let ridgeAzimuthDeg: number;
  if (bestHalfY >= bestHalfX) {
    // First entlang Y im rotierten Frame → im Originalfeld bei `bestAngle` CW
    // gegen Y-Achse (Nord) gedreht. Azimuth (CW von N) = bestAngle.
    halfWidthM = bestHalfX;
    halfLengthM = bestHalfY;
    ridgeAzimuthDeg = bestAngle;
  } else {
    // First entlang X im rotierten Frame → 90° gedreht.
    halfWidthM = bestHalfY;
    halfLengthM = bestHalfX;
    ridgeAzimuthDeg = (bestAngle + 90) % 360;
  }

  return {
    centerLng: c.lng,
    centerLat: c.lat,
    halfWidthM,
    halfLengthM,
    ridgeAzimuthDeg,
  };
}

/** Mappt OSM-`roof:shape`-Werte auf unsere Mock-Kategorien. */
function mapOsmRoofShape(osm: string): RoofShape | null {
  switch (osm) {
    case "gabled":
    case "round":
      return "satteldach";
    case "hipped":
    case "half-hipped":
    case "pyramidal":
    case "mansard":
      return "walmdach";
    case "flat":
    case "dome":
      return "flachdach";
    case "skillion":
    case "shed":
    case "lean_to":
      return "pultdach";
    default:
      return null;
  }
}

/**
 * Schätzt die Dachform.
 * - OSM-Tag schlägt Heuristik.
 * - Sonst: Aspect Ratio + Eckenzahl.
 */
export function guessRoofShape(
  footprint: LngLat[],
  obb: OrientedBox,
  tags: Record<string, string> = {},
): RoofShapeGuess {
  const osmShape = tags["roof:shape"];
  if (osmShape) {
    const mapped = mapOsmRoofShape(osmShape);
    if (mapped) {
      return {
        shape: mapped,
        confidence: 0.9,
        reason: `OSM roof:shape=${osmShape}`,
      };
    }
  }

  // Komplexe Footprints (L-Form, T-Form etc.) → wir können sie nicht
  // sauber als Standard-Schrägdach approximieren; Flachdach ist die
  // sicherste Anzeige bis ein echter LoD2-Datensatz vorliegt.
  const cornerCount = footprint.length;
  if (cornerCount > 8) {
    return {
      shape: "flachdach",
      confidence: 0.4,
      reason: `Komplexer Footprint (${cornerCount} Ecken) – Flachdach als sichere Default-Anzeige`,
    };
  }

  const aspect = obb.halfLengthM / Math.max(0.5, obb.halfWidthM);
  if (aspect >= 1.6) {
    return {
      shape: "satteldach",
      confidence: 0.6,
      reason: `Langgestrecktes Rechteck ${aspect.toFixed(1)}:1 → Satteldach`,
    };
  }
  if (aspect <= 1.25) {
    return {
      shape: "walmdach",
      confidence: 0.55,
      reason: `Quadratischer Grundriss ${aspect.toFixed(1)}:1 → Walmdach`,
    };
  }
  return {
    shape: "satteldach",
    confidence: 0.5,
    reason: `Mittlere Proportion ${aspect.toFixed(1)}:1 → Default Satteldach`,
  };
}

/** Liest Pitch in Grad aus OSM-Tags (`roof:angle`). */
export function parseRoofPitchDeg(tags: Record<string, string>): number | null {
  const raw = tags["roof:angle"];
  if (!raw) return null;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v < 0 || v > 80) return null;
  return v;
}

/** Liest Höhe in Metern aus OSM-Tags (`height` direkt oder `building:levels` × 3 m). */
export function parseBuildingHeightM(
  tags: Record<string, string>,
): { totalM: number; source: "height-tag" | "levels" | "default" } {
  const h = tags["height"];
  if (h) {
    const v = Number.parseFloat(h.replace(",", "."));
    if (Number.isFinite(v) && v > 1 && v < 200) {
      return { totalM: v, source: "height-tag" };
    }
  }
  const levels = tags["building:levels"];
  if (levels) {
    const n = Number.parseFloat(levels.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 50) {
      // 3 m pro Geschoss + 0.5 m Dach-Aufstockung.
      return { totalM: n * 3 + 0.5, source: "levels" };
    }
  }
  return { totalM: 6, source: "default" };
}
