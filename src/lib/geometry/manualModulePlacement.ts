/**
 * Manuelle Modulplatzierung per Mausklick und Hover-Vorschau.
 *
 * Zwei Eintrittspunkte:
 *   - `validatePlacementAtLngLat`  – Karten-View: Klick in lng/lat,
 *     wird auf die Dachebene projiziert.
 *   - `validatePlacementAtFacePoint` – 3D-View: Punkt aus dem Raycaster,
 *     liegt schon auf der Dachebene.
 *
 * Beide kommen zur gleichen Validierung in `validateCandidate`:
 *   1. Liegt der Klick auf einer ausgewählten Dachfläche?
 *   2. Sind auf dieser Fläche schon `MAX_MODULES_PER_FACE` Module?
 *   3. Hat das Modul auf allen 4 Ecken mindestens `MANUAL_EDGE_MARGIN_M`
 *      Abstand zum Polygonrand?
 *   4. Überlappt das Modul (mit `MANUAL_MODULE_GAP_M`-Puffer) ein
 *      bestehendes Modul auf derselben Fläche?
 */

import type {
  DetectedBuilding,
  LngLat,
  ModuleSettings,
  PVModule,
  RoofFace,
  Vec3,
} from "@/types/solar";
import {
  lngLatToLocalMeters,
  localMetersToLngLat,
} from "@/lib/geometry/coordinates";
import {
  calculateFaceNormal,
  cross,
  dot,
  length,
  normalize,
  subtract,
} from "@/lib/geometry/roofMath";
import {
  MAX_MODULES_PER_FACE,
  MANUAL_EDGE_MARGIN_M,
  MANUAL_MODULE_GAP_M,
} from "@/lib/constants";

type LngLatPoint = { lng: number; lat: number };
type UVPoint = { u: number; v: number };

type FaceFrame = {
  origin: Vec3;
  uAxis: Vec3;
  vAxis: Vec3;
};

function pointInPolygonLngLat(p: LngLatPoint, poly: LngLatPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const intersect =
      pi.lat > p.lat !== pj.lat > p.lat &&
      p.lng <
        ((pj.lng - pi.lng) * (p.lat - pi.lat)) / (pj.lat - pi.lat + 1e-12) +
          pi.lng;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonUV(p: UVPoint, poly: UVPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const intersect =
      pi.v > p.v !== pj.v > p.v &&
      p.u < ((pj.u - pi.u) * (p.v - pi.v)) / (pj.v - pi.v + 1e-12) + pi.u;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distancePointToSegment(
  p: UVPoint,
  a: UVPoint,
  b: UVPoint,
): number {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const len2 = du * du + dv * dv;
  if (len2 < 1e-12) {
    const ddu = p.u - a.u;
    const ddv = p.v - a.v;
    return Math.sqrt(ddu * ddu + ddv * ddv);
  }
  const t = Math.max(
    0,
    Math.min(1, ((p.u - a.u) * du + (p.v - a.v) * dv) / len2),
  );
  const cu = a.u + t * du;
  const cv = a.v + t * dv;
  const ddu = p.u - cu;
  const ddv = p.v - cv;
  return Math.sqrt(ddu * ddu + ddv * ddv);
}

function distanceToPolygonEdge(p: UVPoint, poly: UVPoint[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const d = distancePointToSegment(p, a, b);
    if (d < best) best = d;
  }
  return best;
}

function longestEdge(verts: Vec3[]): { from: Vec3; to: Vec3 } {
  let bestLen = 0;
  let best = { from: verts[0]!, to: verts[1] ?? verts[0]! };
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const l = length(subtract(b, a));
    if (l > bestLen) {
      bestLen = l;
      best = { from: a, to: b };
    }
  }
  return best;
}

function faceFrame(face: RoofFace): FaceFrame {
  const n = calculateFaceNormal(face.vertices3d);
  const edge = longestEdge(face.vertices3d);
  const edgeDir = subtract(edge.to, edge.from);
  const uAxis = normalize({
    x: edgeDir.x - n.x * dot(edgeDir, n),
    y: edgeDir.y - n.y * dot(edgeDir, n),
    z: edgeDir.z - n.z * dot(edgeDir, n),
  });
  const vAxis = normalize(cross(n, uAxis));
  return { origin: face.vertices3d[0]!, uAxis, vAxis };
}

function projectToUV(p: Vec3, frame: FaceFrame): UVPoint {
  const d = subtract(p, frame.origin);
  return { u: dot(d, frame.uAxis), v: dot(d, frame.vAxis) };
}

type UVAABB = {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
};

function aabbFromPoints(pts: UVPoint[]): UVAABB {
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of pts) {
    if (p.u < minU) minU = p.u;
    if (p.u > maxU) maxU = p.u;
    if (p.v < minV) minV = p.v;
    if (p.v > maxV) maxV = p.v;
  }
  return { minU, maxU, minV, maxV };
}

function aabbOverlapWithGap(a: UVAABB, b: UVAABB, gap: number): boolean {
  if (a.maxU + gap <= b.minU) return false;
  if (b.maxU + gap <= a.minU) return false;
  if (a.maxV + gap <= b.minV) return false;
  if (b.maxV + gap <= a.minV) return false;
  return true;
}

function faceFootprintLngLat(face: RoofFace, center: LngLat): LngLatPoint[] {
  return face.vertices3d.map((v) =>
    localMetersToLngLat(v.x, v.y, center.lng, center.lat),
  );
}

/** Welche ausgewählte Dachfläche liegt unter einem lng/lat-Klick? */
export function findFaceUnderClick(
  click: LngLat,
  building: DetectedBuilding,
): RoofFace | null {
  for (const face of building.roofFaces) {
    if (!face.selected) continue;
    const poly = faceFootprintLngLat(face, building.center);
    if (pointInPolygonLngLat(click, poly)) return face;
  }
  return null;
}

/** Welches Modul wurde per lng/lat-Klick getroffen? */
export function findModuleUnderClick(
  click: LngLat,
  modules: PVModule[],
  buildingCenter: LngLat,
): PVModule | null {
  for (const mod of modules) {
    const poly = mod.vertices3d.map((v) =>
      localMetersToLngLat(v.x, v.y, buildingCenter.lng, buildingCenter.lat),
    );
    if (pointInPolygonLngLat(click, poly)) return mod;
  }
  return null;
}

/**
 * Welches Modul liegt direkt unter einem 3D-Raycast-Punkt? Wird für den
 * Rechtsklick in der 3D-Ansicht genutzt. Tolerance ist die maximale
 * Distanz orthogonal zur Modulebene, damit floating-point-Drift den
 * Treffer nicht killt.
 */
export function findModuleAtPoint3D(
  point: Vec3,
  modules: PVModule[],
  tolerance = 0.25,
): PVModule | null {
  for (const mod of modules) {
    if (mod.vertices3d.length < 4) continue;
    const a = mod.vertices3d[0]!;
    const b = mod.vertices3d[1]!;
    const d = mod.vertices3d[3]!;
    const eU = subtract(b, a);
    const eV = subtract(d, a);
    const lenU = length(eU);
    const lenV = length(eV);
    if (lenU < 1e-6 || lenV < 1e-6) continue;
    const u = normalize(eU);
    const v = normalize(eV);
    const n = normalize(cross(u, v));
    const rel = subtract(point, a);
    const du = dot(rel, u);
    const dv = dot(rel, v);
    const dn = Math.abs(dot(rel, n));
    if (du < 0 || du > lenU) continue;
    if (dv < 0 || dv > lenV) continue;
    if (dn > tolerance) continue;
    return mod;
  }
  return null;
}

/**
 * Baut ein Modulrechteck zentriert um einen 3D-Punkt, der auf der Dachfläche
 * liegt. Wird sowohl von der Karten- als auch der 3D-Validierung benutzt.
 */
export function createModuleAtFacePoint(
  pointOnFace: Vec3,
  face: RoofFace,
  settings: ModuleSettings,
): PVModule | null {
  if (face.vertices3d.length < 3) return null;
  const frame = faceFrame(face);
  const isPortrait = settings.orientation === "portrait";
  const moduleU = isPortrait ? settings.moduleWidthM : settings.moduleLengthM;
  const moduleV = isPortrait ? settings.moduleLengthM : settings.moduleWidthM;
  const halfU = moduleU / 2;
  const halfV = moduleV / 2;
  const offsets: UVPoint[] = [
    { u: -halfU, v: -halfV },
    { u: halfU, v: -halfV },
    { u: halfU, v: halfV },
    { u: -halfU, v: halfV },
  ];
  const corners: Vec3[] = offsets.map((o) => ({
    x: pointOnFace.x + frame.uAxis.x * o.u + frame.vAxis.x * o.v,
    y: pointOnFace.y + frame.uAxis.y * o.u + frame.vAxis.y * o.v,
    z: pointOnFace.z + frame.uAxis.z * o.u + frame.vAxis.z * o.v,
  }));
  return {
    id: `manual-mod-${face.id}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
    roofFaceId: face.id,
    vertices3d: corners,
    wp: settings.moduleWp,
  };
}

/** Backwards-compat. Wandelt lng/lat in 3D-Punkt auf der Fläche um. */
export function createModuleAtClick(
  click: LngLat,
  face: RoofFace,
  building: DetectedBuilding,
  settings: ModuleSettings,
): PVModule | null {
  const point = projectLngLatOntoFace(click, face, building);
  if (!point) return null;
  return createModuleAtFacePoint(point, face, settings);
}

function projectLngLatOntoFace(
  click: LngLat,
  face: RoofFace,
  building: DetectedBuilding,
): Vec3 | null {
  const xy = lngLatToLocalMeters(
    click.lng,
    click.lat,
    building.center.lng,
    building.center.lat,
  );
  const n = calculateFaceNormal(face.vertices3d);
  const V0 = face.vertices3d[0]!;
  if (Math.abs(n.z) < 1e-9) return null;
  const Z =
    (n.x * V0.x + n.y * V0.y + n.z * V0.z - n.x * xy.x - n.y * xy.y) / n.z;
  return { x: xy.x, y: xy.y, z: Z };
}

export type PlacementReason = "no-face" | "limit" | "edge" | "overlap";

export type PlacementResult =
  | { ok: true; module: PVModule; face: RoofFace }
  | { ok: false; reason: PlacementReason; face: RoofFace | null };

function validateCandidate(
  candidate: PVModule,
  face: RoofFace,
  building: DetectedBuilding,
): PlacementResult {
  const frame = faceFrame(face);
  const polyUV = face.vertices3d.map((v) => projectToUV(v, frame));
  const candUV = candidate.vertices3d.map((v) => projectToUV(v, frame));
  for (const c of candUV) {
    if (!pointInPolygonUV(c, polyUV)) {
      return { ok: false, reason: "edge", face };
    }
    if (distanceToPolygonEdge(c, polyUV) < MANUAL_EDGE_MARGIN_M) {
      return { ok: false, reason: "edge", face };
    }
  }
  const candAABB = aabbFromPoints(candUV);
  for (const m of building.modules) {
    if (m.roofFaceId !== face.id) continue;
    const otherUV = m.vertices3d.map((v) => projectToUV(v, frame));
    const otherAABB = aabbFromPoints(otherUV);
    if (aabbOverlapWithGap(candAABB, otherAABB, MANUAL_MODULE_GAP_M)) {
      return { ok: false, reason: "overlap", face };
    }
  }
  return { ok: true, module: candidate, face };
}

/** Validierung für die Karten-View. Liefert auch im Fehlerfall die Fläche. */
export function validatePlacementAtLngLat(
  click: LngLat,
  building: DetectedBuilding,
  settings: ModuleSettings,
): PlacementResult {
  const face = findFaceUnderClick(click, building);
  if (!face) return { ok: false, reason: "no-face", face: null };
  const modulesOnFace = building.modules.filter(
    (m) => m.roofFaceId === face.id,
  ).length;
  if (modulesOnFace >= MAX_MODULES_PER_FACE) {
    return { ok: false, reason: "limit", face };
  }
  const point = projectLngLatOntoFace(click, face, building);
  if (!point) return { ok: false, reason: "edge", face };
  const candidate = createModuleAtFacePoint(point, face, settings);
  if (!candidate) return { ok: false, reason: "edge", face };
  return validateCandidate(candidate, face, building);
}

/** Validierung für die 3D-View (Raycast liefert den 3D-Punkt direkt). */
export function validatePlacementAtFacePoint(
  pointOnFace: Vec3,
  face: RoofFace,
  building: DetectedBuilding,
  settings: ModuleSettings,
): PlacementResult {
  const inBuilding = building.roofFaces.find((f) => f.id === face.id);
  if (!inBuilding || !inBuilding.selected) {
    return { ok: false, reason: "no-face", face };
  }
  const modulesOnFace = building.modules.filter(
    (m) => m.roofFaceId === face.id,
  ).length;
  if (modulesOnFace >= MAX_MODULES_PER_FACE) {
    return { ok: false, reason: "limit", face };
  }
  const candidate = createModuleAtFacePoint(pointOnFace, face, settings);
  if (!candidate) return { ok: false, reason: "edge", face };
  return validateCandidate(candidate, face, building);
}

export function formatPlacementReason(
  reason: PlacementReason,
  faceLabel?: string | null,
): string {
  switch (reason) {
    case "no-face":
      return "Keine ausgewählte Dachfläche unter dem Klick.";
    case "limit":
      return `Maximum von ${MAX_MODULES_PER_FACE} Modulen auf „${faceLabel ?? "dieser Fläche"}" erreicht.`;
    case "edge":
      return `Zu nah am Dachrand (min. ${Math.round(MANUAL_EDGE_MARGIN_M * 100)} cm).`;
    case "overlap":
      return "Überlappt mit einem anderen Modul.";
  }
}
