/**
 * Modulplatzierung auf einer beliebigen RoofFace.
 *
 * Wichtig: Die Strategie kennt KEINE Dachtypen. Sie arbeitet generisch
 * auf den Vertices der Dachfläche:
 *
 *  1. Bestimme zwei orthogonale Achsen IN der Dachebene (u, v).
 *     - u = Richtung der längsten Polygonkante (in der Dachebene).
 *     - v = u × n (in der Dachebene, orthogonal zu u).
 *  2. Projiziere alle Vertices in das (u, v)-Koordinatensystem.
 *  3. Berechne die 2D-Bounding-Box, ziehe `edgeMarginM` ab.
 *  4. Erzeuge ein Raster von Modulrechtecken (Schrittweite =
 *     Modulgröße + moduleGapM).
 *  5. Verwerfe Module, deren Mittelpunkt nicht im Polygon liegt.
 *  6. Transformiere die 4 Eckpunkte jedes Moduls zurück nach 3D.
 *
 * Für komplexe konkave Polygone ist der Mittelpunkts-Test eine
 * bewusste Vereinfachung für den MVP. Eine spätere Erweiterung würde
 * die Modulrechtecke vollständig gegen das Polygon clippen.
 */

import type { ModuleSettings, PVModule, RoofFace, Vec3 } from "@/types/solar";
import {
  calculateFaceNormal,
  cross,
  dot,
  length,
  normalize,
  subtract,
} from "@/lib/geometry/roofMath";

type UVPoint = { u: number; v: number };

function pointInPolygon2D(p: UVPoint, poly: UVPoint[]): boolean {
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

/** Längste Kante eines geschlossenen Polygons. */
function longestEdge(vertices: Vec3[]): { from: Vec3; to: Vec3; len: number } {
  let best: { from: Vec3; to: Vec3; len: number } = {
    from: vertices[0]!,
    to: vertices[1] ?? vertices[0]!,
    len: 0,
  };
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    const l = length(subtract(b, a));
    if (l > best.len) best = { from: a, to: b, len: l };
  }
  return best;
}

export function placeModulesOnRoofFace(
  face: RoofFace,
  settings: ModuleSettings,
): PVModule[] {
  const verts = face.vertices3d;
  if (verts.length < 3) return [];

  const n = calculateFaceNormal(verts);

  // Längste Kante als u-Achse projizieren in die Dachebene.
  const edge = longestEdge(verts);
  const edgeDir = subtract(edge.to, edge.from);
  // u = edgeDir minus Anteil entlang n (sicherheitshalber).
  const u = normalize({
    x: edgeDir.x - n.x * dot(edgeDir, n),
    y: edgeDir.y - n.y * dot(edgeDir, n),
    z: edgeDir.z - n.z * dot(edgeDir, n),
  });
  const v = normalize(cross(n, u));

  // Ursprung des UV-Systems = erster Vertex.
  const origin = verts[0]!;

  const projected: UVPoint[] = verts.map((p) => {
    const d = subtract(p, origin);
    return { u: dot(d, u), v: dot(d, v) };
  });

  const minU = Math.min(...projected.map((p) => p.u)) + settings.edgeMarginM;
  const maxU = Math.max(...projected.map((p) => p.u)) - settings.edgeMarginM;
  const minV = Math.min(...projected.map((p) => p.v)) + settings.edgeMarginM;
  const maxV = Math.max(...projected.map((p) => p.v)) - settings.edgeMarginM;

  if (maxU <= minU || maxV <= minV) return [];

  const isPortrait = settings.orientation === "portrait";
  // portrait = Modul "steht" → kurze Seite (Breite) in u-Richtung.
  const moduleU = isPortrait ? settings.moduleWidthM : settings.moduleLengthM;
  const moduleV = isPortrait ? settings.moduleLengthM : settings.moduleWidthM;
  const stepU = moduleU + settings.moduleGapM;
  const stepV = moduleV + settings.moduleGapM;

  const modules: PVModule[] = [];
  let idx = 0;

  for (let cv = minV; cv + moduleV <= maxV + 1e-6; cv += stepV) {
    for (let cu = minU; cu + moduleU <= maxU + 1e-6; cu += stepU) {
      const corners2D: UVPoint[] = [
        { u: cu, v: cv },
        { u: cu + moduleU, v: cv },
        { u: cu + moduleU, v: cv + moduleV },
        { u: cu, v: cv + moduleV },
      ];

      // Mittelpunkts-Test gegen Polygon.
      const center: UVPoint = { u: cu + moduleU / 2, v: cv + moduleV / 2 };
      if (!pointInPolygon2D(center, projected)) continue;

      const corners3D: Vec3[] = corners2D.map((p) => ({
        x: origin.x + u.x * p.u + v.x * p.v,
        y: origin.y + u.y * p.u + v.y * p.v,
        z: origin.z + u.z * p.u + v.z * p.v,
      }));

      modules.push({
        id: `${face.id}-mod-${idx++}`,
        roofFaceId: face.id,
        vertices3d: corners3D,
        wp: settings.moduleWp,
      });
    }
  }

  return modules;
}

export function placeModulesOnSelectedFaces(
  faces: RoofFace[],
  settings: ModuleSettings,
): PVModule[] {
  const result: PVModule[] = [];
  for (const face of faces) {
    if (!face.selected) continue;
    result.push(...placeModulesOnRoofFace(face, settings));
  }
  return result;
}
