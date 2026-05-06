/**
 * Mathematische Hilfsfunktionen für Dachflächen.
 *
 * Eine RoofFace ist ein 3D-Polygon (typischerweise Quadrilateral).
 * Wir berechnen aus den Vertices die Flächennormale, daraus Pitch und Azimuth.
 */

import type { Vec3 } from "@/types/solar";

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vec3): Vec3 {
  const l = length(v);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * Flächennormale eines Polygons (Newell-Methode – stabil auch bei
 * leicht nicht-planaren oder degenerierten Eckpunkten).
 * Die Normale zeigt nach "oben", wenn das Polygon im Uhrzeigersinn
 * von oben betrachtet wird (rechte Hand-Regel).
 */
export function calculateFaceNormal(vertices: Vec3[]): Vec3 {
  if (vertices.length < 3) return { x: 0, y: 0, z: 1 };
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < vertices.length; i++) {
    const cur = vertices[i]!;
    const next = vertices[(i + 1) % vertices.length]!;
    nx += (cur.y - next.y) * (cur.z + next.z);
    ny += (cur.z - next.z) * (cur.x + next.x);
    nz += (cur.x - next.x) * (cur.y + next.y);
  }
  const n = normalize({ x: nx, y: ny, z: nz });
  // Konvention: Normale soll Z >= 0 haben (nach oben zeigen).
  if (n.z < 0) return { x: -n.x, y: -n.y, z: -n.z };
  return n;
}

/** Dachneigung in Grad (0° = flach, 90° = vertikal). */
export function calculatePitchDeg(vertices: Vec3[]): number {
  const n = calculateFaceNormal(vertices);
  // Winkel zwischen Normale und Z-Achse.
  const cosT = Math.max(-1, Math.min(1, n.z));
  return (Math.acos(cosT) * 180) / Math.PI;
}

/**
 * Azimuth in Grad, geographisch:
 *   0°   = Norden
 *   90°  = Osten
 *   180° = Süden
 *   270° = Westen
 *
 * Bestimmt aus der Projektion der Flächennormale in die XY-Ebene
 * (zeigt in Richtung Hangabwärts). Für ein flaches Dach undefiniert,
 * Rückgabe = 180° (Süd) als sinnvoller Default.
 */
export function calculateAzimuthDeg(vertices: Vec3[]): number {
  const n = calculateFaceNormal(vertices);
  if (Math.hypot(n.x, n.y) < 1e-6) return 180;
  // n.x = Ost, n.y = Nord. atan2(Ost, Nord) → 0 = Nord, 90 = Ost.
  let az = (Math.atan2(n.x, n.y) * 180) / Math.PI;
  if (az < 0) az += 360;
  return az;
}

/**
 * Fläche eines 3D-Polygons (echte geometrische Fläche, nicht XY-Projektion).
 * 0.5 * |Σ (v_i × v_{i+1})|
 */
export function polygonArea3D(vertices: Vec3[]): number {
  if (vertices.length < 3) return 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    nx += a.y * b.z - a.z * b.y;
    ny += a.z * b.x - a.x * b.z;
    nz += a.x * b.y - a.y * b.x;
  }
  return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
}
