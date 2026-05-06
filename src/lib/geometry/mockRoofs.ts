/**
 * Hochwertige Mock-Dachgeometrien.
 *
 * Erzeugt für verschiedene Gebäudetypen reale `vertices3d` im lokalen
 * Meter-Koordinatensystem (Ursprung = Gebäudezentrum, X = Ost, Y = Nord,
 * Z = Höhe). Die Visualisierung sieht von alledem nichts – sie bekommt
 * nur das einheitliche `RoofFace[]`.
 */

import type { RoofFace, Vec3 } from "@/types/solar";
import {
  calculateAzimuthDeg,
  calculatePitchDeg,
  polygonArea3D,
} from "@/lib/geometry/roofMath";
import { rotatePoint2D } from "@/lib/geometry/coordinates";

export type MockBuildingKind =
  | "satteldach"
  | "walmdach"
  | "flachdach"
  | "pultdach"
  | "komplex";

export type MockBuildingTemplate = {
  kind: MockBuildingKind;
  label: string;
  /** Halbe Gebäudelänge in m (entlang lokaler Y-Achse). */
  halfLengthM: number;
  /** Halbe Gebäudebreite in m (entlang lokaler X-Achse). */
  halfWidthM: number;
  /** Traufhöhe (Wandhöhe) in m. */
  eaveHeightM: number;
  /** Firsthöhe oder höchster Punkt in m. */
  ridgeHeightM: number;
  /** Drehung des Gebäudes um Z in Grad (0 = First in Nord-Süd-Richtung). */
  rotationDeg: number;
  /** Optional: explizite First-Länge in m (nur für Walmdach relevant). */
  ridgeLengthM?: number;
};

export type MockBuilding = {
  template: MockBuildingTemplate;
  footprint: Vec3[];
  roofFaces: RoofFace[];
};

function rot(p: { x: number; y: number }, angleDeg: number) {
  return rotatePoint2D(p.x, p.y, angleDeg);
}

function makeFace(
  id: string,
  label: string,
  vertices3d: Vec3[],
  selected = true,
  metadata?: Record<string, unknown>,
): RoofFace {
  const areaM2 = polygonArea3D(vertices3d);
  const pitchDeg = calculatePitchDeg(vertices3d);
  const azimuthDeg = calculateAzimuthDeg(vertices3d);
  return {
    id,
    label,
    vertices3d,
    pitchDeg,
    azimuthDeg,
    areaM2,
    selected,
    confidence: 1.0,
    source: "mock",
    metadata,
  };
}

/** 4 Eckpunkte eines Rechtecks (Footprint) im lokalen System, gedreht. */
function rectFootprint(
  halfW: number,
  halfL: number,
  rotationDeg: number,
  z = 0,
): Vec3[] {
  const corners: { x: number; y: number }[] = [
    { x: -halfW, y: -halfL },
    { x: halfW, y: -halfL },
    { x: halfW, y: halfL },
    { x: -halfW, y: halfL },
  ];
  return corners.map((c) => {
    const r = rot(c, rotationDeg);
    return { x: r.x, y: r.y, z };
  });
}

function buildSatteldach(t: MockBuildingTemplate): RoofFace[] {
  const { halfWidthM: hw, halfLengthM: hl, eaveHeightM: e, ridgeHeightM: r } = t;
  // First läuft entlang der Y-Achse (Nord-Süd) bei x = 0.
  const ridgeS = rot({ x: 0, y: -hl }, t.rotationDeg);
  const ridgeN = rot({ x: 0, y: hl }, t.rotationDeg);
  const eaveSW = rot({ x: -hw, y: -hl }, t.rotationDeg);
  const eaveNW = rot({ x: -hw, y: hl }, t.rotationDeg);
  const eaveSE = rot({ x: hw, y: -hl }, t.rotationDeg);
  const eaveNE = rot({ x: hw, y: hl }, t.rotationDeg);

  // Westseite (Polygon-Reihenfolge gegen den Uhrzeigersinn von oben):
  const west: Vec3[] = [
    { x: eaveSW.x, y: eaveSW.y, z: e },
    { x: ridgeS.x, y: ridgeS.y, z: r },
    { x: ridgeN.x, y: ridgeN.y, z: r },
    { x: eaveNW.x, y: eaveNW.y, z: e },
  ];
  // Ostseite:
  const east: Vec3[] = [
    { x: eaveSE.x, y: eaveSE.y, z: e },
    { x: eaveNE.x, y: eaveNE.y, z: e },
    { x: ridgeN.x, y: ridgeN.y, z: r },
    { x: ridgeS.x, y: ridgeS.y, z: r },
  ];

  return [
    makeFace("face-w", "Dachfläche West", west, true),
    makeFace("face-e", "Dachfläche Ost", east, true),
  ];
}

function buildWalmdach(t: MockBuildingTemplate): RoofFace[] {
  const { halfWidthM: hw, halfLengthM: hl, eaveHeightM: e, ridgeHeightM: r } = t;
  // First verkürzt: Walm an Süd- und Nordseite.
  // Wenn `ridgeLengthM` gesetzt ist, leiten wir den Verkürzungs-Offset daraus
  // ab (First-Länge = 2 * (hl - shorten)). Sonst Default-Heuristik.
  const ridgeShortenY =
    t.ridgeLengthM !== undefined
      ? Math.max(0, hl - t.ridgeLengthM / 2)
      : Math.min(hl * 0.5, hw);
  const ridgeS = rot({ x: 0, y: -hl + ridgeShortenY }, t.rotationDeg);
  const ridgeN = rot({ x: 0, y: hl - ridgeShortenY }, t.rotationDeg);
  const eaveSW = rot({ x: -hw, y: -hl }, t.rotationDeg);
  const eaveNW = rot({ x: -hw, y: hl }, t.rotationDeg);
  const eaveSE = rot({ x: hw, y: -hl }, t.rotationDeg);
  const eaveNE = rot({ x: hw, y: hl }, t.rotationDeg);

  const west: Vec3[] = [
    { x: eaveSW.x, y: eaveSW.y, z: e },
    { x: ridgeS.x, y: ridgeS.y, z: r },
    { x: ridgeN.x, y: ridgeN.y, z: r },
    { x: eaveNW.x, y: eaveNW.y, z: e },
  ];
  const east: Vec3[] = [
    { x: eaveSE.x, y: eaveSE.y, z: e },
    { x: eaveNE.x, y: eaveNE.y, z: e },
    { x: ridgeN.x, y: ridgeN.y, z: r },
    { x: ridgeS.x, y: ridgeS.y, z: r },
  ];
  // Walm Süd (Dreieck):
  const south: Vec3[] = [
    { x: eaveSW.x, y: eaveSW.y, z: e },
    { x: eaveSE.x, y: eaveSE.y, z: e },
    { x: ridgeS.x, y: ridgeS.y, z: r },
  ];
  // Walm Nord (Dreieck):
  const north: Vec3[] = [
    { x: eaveNE.x, y: eaveNE.y, z: e },
    { x: eaveNW.x, y: eaveNW.y, z: e },
    { x: ridgeN.x, y: ridgeN.y, z: r },
  ];

  return [
    makeFace("face-w", "Dachfläche West", west, true),
    makeFace("face-e", "Dachfläche Ost", east, true),
    makeFace("face-s", "Walm Süd", south, false),
    makeFace("face-n", "Walm Nord", north, false),
  ];
}

function buildFlachdach(t: MockBuildingTemplate): RoofFace[] {
  const { halfWidthM: hw, halfLengthM: hl, ridgeHeightM: r } = t;
  const verts = [
    rot({ x: -hw, y: -hl }, t.rotationDeg),
    rot({ x: hw, y: -hl }, t.rotationDeg),
    rot({ x: hw, y: hl }, t.rotationDeg),
    rot({ x: -hw, y: hl }, t.rotationDeg),
  ].map((p) => ({ x: p.x, y: p.y, z: r }));
  return [makeFace("face-flat", "Flachdach", verts, true)];
}

function buildPultdach(t: MockBuildingTemplate): RoofFace[] {
  const { halfWidthM: hw, halfLengthM: hl, eaveHeightM: e, ridgeHeightM: r } = t;
  // Hoch im Westen, niedrig im Osten.
  const verts = [
    { ...rot({ x: -hw, y: -hl }, t.rotationDeg), z: r },
    { ...rot({ x: hw, y: -hl }, t.rotationDeg), z: e },
    { ...rot({ x: hw, y: hl }, t.rotationDeg), z: e },
    { ...rot({ x: -hw, y: hl }, t.rotationDeg), z: r },
  ];
  return [makeFace("face-pult", "Pultdach", verts, true)];
}

function buildKomplex(t: MockBuildingTemplate): RoofFace[] {
  // Hauptgebäude (Satteldach) + L-förmiger Anbau (Satteldach 90° gedreht).
  const main: MockBuildingTemplate = {
    ...t,
    halfWidthM: t.halfWidthM * 0.7,
    halfLengthM: t.halfLengthM,
  };
  const mainFaces = buildSatteldach(main).map((f, i) => ({
    ...f,
    id: `main-${f.id}-${i}`,
    label: `Hauptdach ${f.label.replace("Dachfläche ", "")}`,
  }));

  // Anbau im Osten, First quer (X-Richtung).
  const annexHalfW = t.halfWidthM * 0.4;
  const annexHalfL = t.halfLengthM * 0.4;
  const annexCenterX = t.halfWidthM * 0.7 + annexHalfW;
  const annexCenterY = -t.halfLengthM * 0.3;
  const e = t.eaveHeightM;
  const r = t.eaveHeightM + (t.ridgeHeightM - t.eaveHeightM) * 0.7;

  // Anbau-Eckpunkte (vor Rotation), First entlang der X-Achse.
  const ridgeW = { x: -annexHalfW, y: 0 };
  const ridgeE = { x: annexHalfW, y: 0 };
  const eaveSW = { x: -annexHalfW, y: -annexHalfL };
  const eaveSE = { x: annexHalfW, y: -annexHalfL };
  const eaveNW = { x: -annexHalfW, y: annexHalfL };
  const eaveNE = { x: annexHalfW, y: annexHalfL };

  const place = (p: { x: number; y: number }) => {
    const shifted = { x: p.x + annexCenterX, y: p.y + annexCenterY };
    const r2 = rot(shifted, t.rotationDeg);
    return r2;
  };

  const south3D: Vec3[] = [
    { ...place(eaveSW), z: e },
    { ...place(eaveSE), z: e },
    { ...place(ridgeE), z: r },
    { ...place(ridgeW), z: r },
  ];
  const north3D: Vec3[] = [
    { ...place(eaveNE), z: e },
    { ...place(eaveNW), z: e },
    { ...place(ridgeW), z: r },
    { ...place(ridgeE), z: r },
  ];

  return [
    ...mainFaces,
    makeFace("annex-s", "Anbau Süd", south3D, true),
    makeFace("annex-n", "Anbau Nord", north3D, false),
  ];
}

export function buildMockRoofFaces(t: MockBuildingTemplate): RoofFace[] {
  switch (t.kind) {
    case "satteldach":
      return buildSatteldach(t);
    case "walmdach":
      return buildWalmdach(t);
    case "flachdach":
      return buildFlachdach(t);
    case "pultdach":
      return buildPultdach(t);
    case "komplex":
      return buildKomplex(t);
  }
}

export function buildMockFootprint(t: MockBuildingTemplate): Vec3[] {
  return rectFootprint(t.halfWidthM, t.halfLengthM, t.rotationDeg, 0);
}

export const MOCK_TEMPLATES: Record<MockBuildingKind, MockBuildingTemplate> = {
  satteldach: {
    kind: "satteldach",
    label: "Einfamilienhaus Satteldach",
    halfWidthM: 5,
    halfLengthM: 7,
    eaveHeightM: 5,
    ridgeHeightM: 9,
    rotationDeg: 15,
  },
  walmdach: {
    kind: "walmdach",
    label: "Walmdach",
    // Gebäudemaße: 10 m × 20 m. Bei First-Länge 10 m bleibt für die Walm-
    // Triangel an Süd/Nord ein Y-Run von 5 m – das ergibt zusammen mit
    // halfWidthM 5 m exakt den gleichen Pitch (40°) wie auf West/Ost.
    halfWidthM: 5,
    halfLengthM: 10,
    eaveHeightM: 4.5,
    // Pitch 40° auf allen 4 Flächen: rise = 5 * tan(40°) ≈ 4.2 m.
    ridgeHeightM: 8.7,
    // Explizite First-Länge: 10 m.
    ridgeLengthM: 10,
    // Gerade ausgerichtet, kein Drehwinkel.
    rotationDeg: 0,
  },
  flachdach: {
    kind: "flachdach",
    label: "Flachdach",
    halfWidthM: 7,
    halfLengthM: 9,
    eaveHeightM: 8,
    ridgeHeightM: 8,
    rotationDeg: 0,
  },
  pultdach: {
    kind: "pultdach",
    label: "Pultdach",
    halfWidthM: 5,
    halfLengthM: 8,
    eaveHeightM: 4,
    ridgeHeightM: 7,
    rotationDeg: 5,
  },
  komplex: {
    kind: "komplex",
    label: "Haus mit Anbau",
    halfWidthM: 7,
    halfLengthM: 9,
    eaveHeightM: 5,
    ridgeHeightM: 9,
    rotationDeg: 25,
  },
};
