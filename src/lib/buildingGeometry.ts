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
import { calculateEfficiency, efficiencyColor } from "@/lib/efficiency";

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

  const footprintLocal = footprintToLocal(building);
  const eaveZ = estimateEaveHeight(building);

  if (includeWalls && footprintLocal && eaveZ > 0) {
    group.add(buildWalls(footprintLocal, 0, eaveZ, materials, showEdges));

    // Giebelwände (Stirnseiten) schließen das Volumen zwischen Wand-Top und
    // Dachfirst. Nur sinnvoll, wenn wir auch die Wände gebaut haben.
    for (const m of buildGables(building, footprintLocal, eaveZ, materials)) {
      group.add(m);
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

/**
 * Hausvolumen als geschlossenes Solid via THREE.ExtrudeGeometry.
 *
 * Vorteile gegenüber per-Hand triangulierten Wand-Quads:
 *   - Wasserdicht: Boden, Top und alle Seitenwände werden in EINEM Mesh
 *     erzeugt, keine fehlenden Faces, kein „durch die Wand gucken".
 *   - Korrekte Außen-Normals unabhängig vom Winding des Footprints.
 *     Falls der Polygon im Uhrzeigersinn vorliegt (z. B. aus OSM oder
 *     mock-Generator), drehen wir vorher um.
 *   - computeVertexNormals() liefert konsistente flat-shaded Wände.
 */
function buildWalls(
  footprint: Vec3[],
  baseZ: number,
  topZ: number,
  materials: Materials,
  showEdges: boolean,
): THREE.Object3D {
  const group = new THREE.Group();
  group.userData = { kind: "walls" };
  if (footprint.length < 3) return group;

  // 2D-Shape aus dem Footprint. ExtrudeGeometry erwartet CCW-Reihenfolge
  // für die Außenkante; CW würde als Loch interpretiert werden.
  const points = footprint.map((v) => new THREE.Vector2(v.x, v.y));
  if (THREE.ShapeUtils.isClockWise(points)) {
    points.reverse();
  }
  const shape = new THREE.Shape(points);

  const depth = Math.max(0.1, topZ - baseZ);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
  });
  // ExtrudeGeometry extrudiert in +Z. Bottom liegt bei z=0; auf baseZ heben.
  if (baseZ !== 0) geom.translate(0, 0, baseZ);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, materials.building);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Optisch markante Top-Edges + vertikale Eckkanten als Linien.
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

/**
 * Eine Dachfläche besteht aus zwei Mesh-Layern:
 *
 *   1. roofBase (Anthrazit) – wird IMMER gerendert. Sorgt dafür, dass die
 *      Schräge sichtbar geschlossen ist, unabhängig vom selected-Flag.
 *   2. roofHighlight (Blau, leicht transparent) – nur wenn face.selected.
 *      Liegt via polygonOffset minimal über der Basis und markiert
 *      PV-taugliche Flächen ohne Z-Fighting.
 *
 * Beide Meshes teilen sich dieselbe Geometrie (Geometry-Sharing ist
 * unproblematisch, dispose wird per WeakSet abgesichert).
 */
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

  const userData = {
    kind: "roof" as const,
    roofFaceId: face.id,
    label: face.label,
    areaM2: face.areaM2,
    pitchDeg: face.pitchDeg,
    azimuthDeg: face.azimuthDeg,
  };

  const baseMesh = new THREE.Mesh(geom, materials.roofBase);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.userData = { ...userData };

  const out: THREE.Object3D[] = [baseMesh];

  if (face.selected) {
    // Highlight-Material pro Fläche clonen, damit jede Fläche ihre
    // Effizienz-Farbe trägt. dispose erfolgt über die `__cloneMat`-Markierung
    // in disposeBuildingGroup.
    const overlayMat = (materials.roofHighlight as THREE.MeshStandardMaterial)
      .clone() as THREE.MeshStandardMaterial;
    const eff = calculateEfficiency(face.azimuthDeg, face.pitchDeg);
    overlayMat.color = new THREE.Color(efficiencyColor(eff));
    const overlayMesh = new THREE.Mesh(geom, overlayMat);
    overlayMesh.castShadow = false;
    overlayMesh.receiveShadow = false;
    overlayMesh.userData = { ...userData, overlay: true, __cloneMat: true };
    out.push(overlayMesh);
  }

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

/* --- Giebelwände --- */

/**
 * Schließt die Stirnseiten des Gebäudes, falls über einer Footprint-Kante
 * KEINE Dachfläche mit passender Eave-Kante sitzt (typischer Fall: Satteldach
 * an den kurzen Seiten).
 *
 * Algorithmus pro Footprint-Kante (a → b):
 *   1. Prüfe, ob irgendeine Dachfläche zwei Eckpunkte bei z ≈ eaveZ hat,
 *      die exakt an a und b liegen. Wenn ja → kein Giebel.
 *   2. Sonst: finde den höchsten Roof-Vertex, dessen XY-Position dem
 *      Mittelpunkt von (a, b) am nächsten liegt → Ridge-Apex.
 *   3. Baue ein Dreieck (a@eave, b@eave, apex).
 *
 * Robust für Satteldach (zwei Giebel), Walmdach (keine Giebel weil alle
 * Footprint-Kanten ein Eave haben), Flachdach (keine, alle Vertices liegen
 * auf eaveZ). Für Pultdach passt es auf den Stirn-Triangeln; die
 * Trapez-Seitenwand wird durch unsere Triangle-Heuristik nur teilweise
 * gefüllt – akzeptable Approximation.
 */
function buildGables(
  building: DetectedBuilding,
  footprint: Vec3[],
  eaveZ: number,
  materials: Materials,
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  if (footprint.length < 3 || building.roofFaces.length === 0) return out;

  // Match-Toleranz für „liegt auf der Eave-Kante" und „liegt am Footprint-Eckpunkt".
  const ZTOL = 0.5;
  const XYTOL = 0.5;

  // Alle Vertices, die deutlich über der Traufe liegen → potenzielle Ridge-Apexes.
  const ridgeVertices: Vec3[] = [];
  for (const face of building.roofFaces) {
    for (const v of face.vertices3d) {
      if (v.z > eaveZ + 0.1) ridgeVertices.push(v);
    }
  }
  if (ridgeVertices.length === 0) return out;

  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]!;
    const b = footprint[(i + 1) % footprint.length]!;

    // Hat eine Dachfläche zwei Eave-Vertices passend zu (a, b)?
    const hasRoofAbove = building.roofFaces.some((face) => {
      const low = face.vertices3d.filter((v) => Math.abs(v.z - eaveZ) < ZTOL);
      if (low.length < 2) return false;
      const matchA = low.some(
        (v) => Math.hypot(v.x - a.x, v.y - a.y) < XYTOL,
      );
      const matchB = low.some(
        (v) => Math.hypot(v.x - b.x, v.y - b.y) < XYTOL,
      );
      return matchA && matchB;
    });
    if (hasRoofAbove) continue;

    // Nächsten Ridge-Apex zum Mittelpunkt von (a, b) suchen, höhere
    // Apexes leicht bevorzugen (Score = Distanz – Höhen-Bonus).
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    let apex: Vec3 | null = null;
    let bestScore = Infinity;
    for (const v of ridgeVertices) {
      const d = Math.hypot(v.x - midX, v.y - midY);
      const score = d - (v.z - eaveZ) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        apex = v;
      }
    }
    if (!apex) continue;

    // Degeneriertes Dreieck (z. B. wenn apex direkt auf einem der Eckpunkte
    // liegt) auslassen.
    const apexDist = Math.min(
      Math.hypot(apex.x - a.x, apex.y - a.y),
      Math.hypot(apex.x - b.x, apex.y - b.y),
    );
    if (apexDist < 0.05 && Math.abs(apex.z - eaveZ) < 0.1) continue;

    const positions = [
      a.x, a.y, eaveZ,
      b.x, b.y, eaveZ,
      apex.x, apex.y, apex.z,
    ];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, materials.gable);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "gable" };
    out.push(mesh);
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
    slotId: mod.slotId,
    wp: mod.wp,
  };
  return mesh;
}

/**
 * Räumt alle Geometrien in einem Group-Subtree auf. Materialien werden
 * NICHT disposed – die werden vom Caller zentral verwaltet.
 *
 * WeakSet sichert ab, dass eine geteilte BufferGeometry (Roof-Basis +
 * Roof-Overlay teilen sich dieselbe Geometrie) nicht zweimal disposed wird.
 */
export function disposeBuildingGroup(group: THREE.Group) {
  const disposed = new WeakSet<THREE.BufferGeometry>();
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geom && !disposed.has(geom)) {
      disposed.add(geom);
      geom.dispose();
    }
    // Per-Face geclonte Materialien (markiert via userData.__cloneMat)
    // werden hier disposed; geteilte Materials aus `materials.*` nicht.
    if (mesh.userData?.__cloneMat) {
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}
