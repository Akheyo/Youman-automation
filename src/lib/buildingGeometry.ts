/**
 * Geteilter Geometrie-Builder für das Gebäude in 3D.
 *
 * Wird von zwei Render-Pfaden konsumiert:
 *
 *   1. `ThreeBuildingLayer` (MapLibre Custom Layer): Geometrie wird in lokalen
 *      Meter-Koordinaten gebaut; der Layer transformiert sie zur Render-Zeit in
 *      Mercator (Translation, Y-Flip, Meter-Skalierung). Wände kommen via
 *      fill-extrusion vom `NativeBuildingLayer`, deshalb default `includeWalls=false`
 *      für mode `mercator`.
 *
 *   2. `Building3DView` (eigenständige Three-Szene): braucht Wände, Dachflächen
 *      und Module zusammen, Origin im Ursprung der Szene. Mode `local`,
 *      Default `includeWalls=true`.
 *
 * Koordinatensystem: X = Ost, Y = Nord, Z = Höhe. Der `Building3DView`-Caller
 * arbeitet mit `camera.up = (0, 0, 1)` und behält damit dasselbe System.
 */

import * as THREE from "three";

import type {
  DetectedBuilding,
  PVModule,
  RoofFace,
  Vec3,
} from "@/types/solar";
import { lngLatToLocalMeters } from "@/lib/geometry/coordinates";
import type { Materials } from "@/lib/map/materials";

export type BuildBuildingMode = "mercator" | "local";

export type BuildBuildingOptions = {
  mode: BuildBuildingMode;
  /** Wände extrudieren. Default: false für mercator (fill-extrusion macht das),
   *  true für local. */
  includeWalls?: boolean;
  /** Kantenlinien auf Dachflächen und Wänden zeichnen. Default: true. */
  showEdges?: boolean;
};

/**
 * Baut die komplette Gebäude-Geometrie und gibt sie als THREE.Group zurück.
 *
 * Children-userData-Konvention für späteres Filtern (Raycast, Toggle):
 *   - `kind: "walls"`     → Wand-Mesh-Group inkl. Kantenlinien
 *   - `kind: "roof"`      → Dach-Mesh oder Dach-Kantenlinie (`roofFaceId` gesetzt)
 *   - `kind: "module"`    → PV-Modul-Mesh (`moduleId` gesetzt)
 */
export function buildBuildingGroup(
  building: DetectedBuilding,
  materials: Materials,
  options: BuildBuildingOptions,
): THREE.Group {
  const group = new THREE.Group();
  group.userData = { kind: "building" };

  const includeWalls = options.includeWalls ?? options.mode === "local";
  const showEdges = options.showEdges ?? true;

  if (includeWalls) {
    const footprintLocal = footprintToLocal(building);
    const eaveZ = estimateEaveHeight(building);
    if (footprintLocal && eaveZ > 0) {
      group.add(buildWalls(footprintLocal, 0, eaveZ, materials, showEdges));
    }
  }

  for (const face of building.roofFaces) {
    for (const m of buildRoofFace(face, materials, showEdges)) {
      group.add(m);
    }
  }

  for (const mod of building.modules) {
    group.add(buildModule(mod, materials));
  }

  return group;
}

/* ----------------------------- Helpers ----------------------------- */

export function footprintToLocal(b: DetectedBuilding): Vec3[] | null {
  if (!b.footprint || b.footprint.vertices.length < 3) return null;
  return b.footprint.vertices.map((p) => {
    const m = lngLatToLocalMeters(p.lng, p.lat, b.center.lng, b.center.lat);
    return { x: m.x, y: m.y, z: 0 };
  });
}

export function estimateEaveHeight(b: DetectedBuilding): number {
  if (b.roofFaces.length === 0) return 0;
  let minZ = Infinity;
  for (const face of b.roofFaces) {
    for (const v of face.vertices3d) {
      if (v.z < minZ) minZ = v.z;
    }
  }
  return Number.isFinite(minZ) ? minZ : 0;
}

export function estimateRidgeHeight(b: DetectedBuilding): number {
  let maxZ = 0;
  for (const face of b.roofFaces) {
    for (const v of face.vertices3d) {
      if (v.z > maxZ) maxZ = v.z;
    }
  }
  return maxZ;
}

/* --- Wände --- */

function buildWalls(
  footprint: Vec3[],
  baseZ: number,
  topZ: number,
  materials: Materials,
  showEdges: boolean,
): THREE.Object3D {
  const group = new THREE.Group();
  group.userData = { kind: "walls" };
  const positions: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]!;
    const b = footprint[(i + 1) % footprint.length]!;
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(ab.x, ab.y) || 1;
    const nx = ab.y / len;
    const ny = -ab.x / len;

    const v0 = [a.x, a.y, baseZ];
    const v1 = [b.x, b.y, baseZ];
    const v2 = [b.x, b.y, topZ];
    const v3 = [a.x, a.y, topZ];

    positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
    for (let k = 0; k < 6; k++) normals.push(nx, ny, 0);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  const mesh = new THREE.Mesh(geom, materials.building);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  if (showEdges) {
    const edgePos: number[] = [];
    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i]!;
      const b = footprint[(i + 1) % footprint.length]!;
      edgePos.push(a.x, a.y, topZ, b.x, b.y, topZ);
      edgePos.push(a.x, a.y, baseZ, a.x, a.y, topZ);
    }
    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(edgePos, 3),
    );
    group.add(new THREE.LineSegments(edgeGeom, materials.edges));
  }
  return group;
}

/* --- Dachflächen --- */

function buildRoofFace(
  face: RoofFace,
  materials: Materials,
  showEdges: boolean,
): THREE.Object3D[] {
  const verts = face.vertices3d;
  if (verts.length < 3) return [];

  const positions: number[] = [];
  for (let i = 1; i < verts.length - 1; i++) {
    const a = verts[0]!;
    const b = verts[i]!;
    const c = verts[i + 1]!;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();

  const mat = face.selected
    ? materials.roofSelected
    : materials.roofUnselected;
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    kind: "roof",
    roofFaceId: face.id,
    label: face.label,
    areaM2: face.areaM2,
    pitchDeg: face.pitchDeg,
    azimuthDeg: face.azimuthDeg,
  };

  const out: THREE.Object3D[] = [mesh];

  if (showEdges) {
    const edgePos: number[] = [];
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i]!;
      const b = verts[(i + 1) % verts.length]!;
      edgePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(edgePos, 3),
    );
    const lines = new THREE.LineSegments(edgeGeom, materials.edges);
    lines.userData = { kind: "roof", roofFaceId: face.id };
    out.push(lines);
  }
  return out;
}

/* --- PV-Module --- */

function buildModule(mod: PVModule, materials: Materials): THREE.Object3D {
  const verts = mod.vertices3d;
  const lift = 0.06;
  const positions: number[] = [];
  if (verts.length >= 3) {
    for (let i = 1; i < verts.length - 1; i++) {
      const a = verts[0]!;
      const b = verts[i]!;
      const c = verts[i + 1]!;
      positions.push(a.x, a.y, a.z + lift);
      positions.push(b.x, b.y, b.z + lift);
      positions.push(c.x, c.y, c.z + lift);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, materials.module);
  mesh.castShadow = true;
  mesh.userData = {
    kind: "module",
    moduleId: mod.id,
    roofFaceId: mod.roofFaceId,
    wp: mod.wp,
  };
  return mesh;
}

/**
 * Räumt alle Geometrien in einem Group-Subtree auf. Materialien werden
 * NICHT disposed – die werden vom Caller zentral verwaltet.
 */
export function disposeBuildingGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).geometry) {
      (obj as THREE.Mesh).geometry.dispose();
    }
  });
}
