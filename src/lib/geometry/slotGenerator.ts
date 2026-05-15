/**
 * Erzeugt ein Raster aus vordefinierten Modul-Slots auf einer Dachfläche.
 *
 * Vorgehen:
 *   1. Frame der Fläche bestimmen (u/v in der Dachebene, längste Polygonkante
 *      definiert u). Identisch zur Logik in `manualModulePlacement.ts` und
 *      `modulePlacement.ts`, damit Auto- und Slot-Layouts geometrisch konsistent
 *      sind.
 *   2. Polygon in das (u, v)-Koordinatensystem projizieren.
 *   3. Bounding-Box bestimmen, um `MANUAL_EDGE_MARGIN_M` schrumpfen.
 *   4. Raster mit Schrittweite (Modulgröße + `MANUAL_MODULE_GAP_M`) auslegen.
 *   5. Jeden Slot validieren: alle 4 Ecken müssen im Polygon liegen UND ≥
 *      `MANUAL_EDGE_MARGIN_M` Abstand zur nächsten Polygonkante haben.
 *   6. Bei mehr als `MAX_MODULES_PER_FACE` zulässigen Slots: die ersten 32
 *      in Lese-Reihenfolge (Zeile von unten nach oben, Spalte von links nach
 *      rechts) behalten.
 *   7. Slots zurück nach 3D-Welt-Koordinaten transformieren.
 */

import type { ModuleSettings, ModuleSlot, RoofFace, Vec3 } from "@/types/solar";
import {
  calculateFaceNormal,
  cross,
  dot,
  length,
  normalize,
  subtract,
} from "@/lib/geometry/roofMath";
import {
  MANUAL_EDGE_MARGIN_M,
  MANUAL_MODULE_GAP_M,
  MAX_MODULES_PER_FACE,
} from "@/lib/constants";

type UVPoint = { u: number; v: number };

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

function distancePointToSegment(p: UVPoint, a: UVPoint, b: UVPoint): number {
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

export function generateSlotsForFace(
  face: RoofFace,
  settings: ModuleSettings,
): ModuleSlot[] {
  const verts = face.vertices3d;
  if (verts.length < 3) return [];

  const n = calculateFaceNormal(verts);
  const edge = longestEdge(verts);
  const edgeDir = subtract(edge.to, edge.from);
  const uAxis = normalize({
    x: edgeDir.x - n.x * dot(edgeDir, n),
    y: edgeDir.y - n.y * dot(edgeDir, n),
    z: edgeDir.z - n.z * dot(edgeDir, n),
  });
  const vAxis = normalize(cross(n, uAxis));
  const origin = verts[0]!;

  const polyUV: UVPoint[] = verts.map((p) => {
    const d = subtract(p, origin);
    return { u: dot(d, uAxis), v: dot(d, vAxis) };
  });

  const isPortrait = settings.orientation === "portrait";
  const moduleU = isPortrait ? settings.moduleWidthM : settings.moduleLengthM;
  const moduleV = isPortrait ? settings.moduleLengthM : settings.moduleWidthM;
  const stepU = moduleU + MANUAL_MODULE_GAP_M;
  const stepV = moduleV + MANUAL_MODULE_GAP_M;

  const minU = Math.min(...polyUV.map((p) => p.u)) + MANUAL_EDGE_MARGIN_M;
  const maxU = Math.max(...polyUV.map((p) => p.u)) - MANUAL_EDGE_MARGIN_M;
  const minV = Math.min(...polyUV.map((p) => p.v)) + MANUAL_EDGE_MARGIN_M;
  const maxV = Math.max(...polyUV.map((p) => p.v)) - MANUAL_EDGE_MARGIN_M;
  if (maxU <= minU || maxV <= minV) return [];

  const slots: ModuleSlot[] = [];
  let row = 0;
  for (let cv = minV; cv + moduleV <= maxV + 1e-6; cv += stepV) {
    let col = 0;
    for (let cu = minU; cu + moduleU <= maxU + 1e-6; cu += stepU) {
      const cornersUV: UVPoint[] = [
        { u: cu, v: cv },
        { u: cu + moduleU, v: cv },
        { u: cu + moduleU, v: cv + moduleV },
        { u: cu, v: cv + moduleV },
      ];
      const allValid = cornersUV.every(
        (p) =>
          pointInPolygonUV(p, polyUV) &&
          distanceToPolygonEdge(p, polyUV) >= MANUAL_EDGE_MARGIN_M - 1e-6,
      );
      if (!allValid) {
        col += 1;
        continue;
      }
      const centerUV: UVPoint = {
        u: cu + moduleU / 2,
        v: cv + moduleV / 2,
      };
      const toWorld = (p: UVPoint): Vec3 => ({
        x: origin.x + uAxis.x * p.u + vAxis.x * p.v,
        y: origin.y + uAxis.y * p.u + vAxis.y * p.v,
        z: origin.z + uAxis.z * p.u + vAxis.z * p.v,
      });
      slots.push({
        id: `${face.id}-r${row}-c${col}`,
        roofFaceId: face.id,
        row,
        col,
        center: toWorld(centerUV),
        corners: cornersUV.map(toWorld),
      });
      if (slots.length >= MAX_MODULES_PER_FACE) return slots;
      col += 1;
    }
    row += 1;
  }
  return slots;
}

/** Slots für alle ausgewählten Dachflächen eines Gebäudes. */
export function generateSlotsForBuilding(
  faces: RoofFace[],
  settings: ModuleSettings,
): ModuleSlot[] {
  const out: ModuleSlot[] = [];
  for (const f of faces) {
    if (!f.selected) continue;
    out.push(...generateSlotsForFace(f, settings));
  }
  return out;
}
