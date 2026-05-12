/**
 * Manuelle Modulplatzierung per Mausklick.
 *
 * Workflow:
 *   1. User klickt auf die Karte (lng/lat).
 *   2. `findFaceUnderClick` ermittelt, welche Dachfläche getroffen wurde,
 *      indem die 3D-Vertices in lng/lat projiziert werden und der Klick
 *      gegen das resultierende 2D-Polygon getestet wird.
 *   3. `findModuleUnderClick` prüft vorher, ob auf ein bestehendes Modul
 *      geklickt wurde → der wird dann entfernt.
 *   4. Sonst baut `createModuleAtClick` ein neues Modulrechteck:
 *      Der Klickpunkt wird auf die Dachebene projiziert (Plane-Gleichung
 *      n · (P − V₀) = 0), und ein Rechteck der konfigurierten Modulgröße
 *      wird in den lokalen u/v-Achsen der Dachfläche um den Klickpunkt
 *      aufgespannt.
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

type LngLatPoint = { lng: number; lat: number };

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

/** Liefert das (von oben gesehene) Polygon einer RoofFace in lng/lat. */
function faceFootprintLngLat(face: RoofFace, center: LngLat): LngLatPoint[] {
  return face.vertices3d.map((v) =>
    localMetersToLngLat(v.x, v.y, center.lng, center.lat),
  );
}

/** Welche Dachfläche liegt unter einem Klick? */
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

/** Liefert das Modul unter einem Klick (oder null). */
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
 * Erzeugt ein neues Modulrechteck zentriert um den Klickpunkt auf der
 * angegebenen Dachfläche.
 */
export function createModuleAtClick(
  click: LngLat,
  face: RoofFace,
  building: DetectedBuilding,
  settings: ModuleSettings,
): PVModule | null {
  if (face.vertices3d.length < 3) return null;

  // 1) Klick in lokales Meter-System (X = Ost, Y = Nord). Z bestimmen wir aus
  //    der Dachebene.
  const xy = lngLatToLocalMeters(
    click.lng,
    click.lat,
    building.center.lng,
    building.center.lat,
  );

  // 2) Dachebene n · (P − V₀) = 0 nach Z aufgelöst.
  const n = calculateFaceNormal(face.vertices3d);
  const V0 = face.vertices3d[0]!;
  const denom = n.z;
  if (Math.abs(denom) < 1e-9) return null;
  const Z =
    (n.x * V0.x + n.y * V0.y + n.z * V0.z - n.x * xy.x - n.y * xy.y) / denom;
  const clickOnFace: Vec3 = { x: xy.x, y: xy.y, z: Z };

  // 3) u/v-Achsen auf der Dachfläche – u entlang der längsten Polygonkante.
  const edge = longestEdge(face.vertices3d);
  const edgeDir = subtract(edge.to, edge.from);
  const u = normalize({
    x: edgeDir.x - n.x * dot(edgeDir, n),
    y: edgeDir.y - n.y * dot(edgeDir, n),
    z: edgeDir.z - n.z * dot(edgeDir, n),
  });
  const v = normalize(cross(n, u));

  // 4) Modulgrößen je nach Orientation.
  const isPortrait = settings.orientation === "portrait";
  const moduleU = isPortrait ? settings.moduleWidthM : settings.moduleLengthM;
  const moduleV = isPortrait ? settings.moduleLengthM : settings.moduleWidthM;
  const halfU = moduleU / 2;
  const halfV = moduleV / 2;

  // 5) 4 Eckpunkte um clickOnFace.
  const corners: Vec3[] = [
    { x: -halfU, y: -halfV },
    { x: halfU, y: -halfV },
    { x: halfU, y: halfV },
    { x: -halfU, y: halfV },
  ].map((c) => ({
    x: clickOnFace.x + u.x * c.x + v.x * c.y,
    y: clickOnFace.y + u.y * c.x + v.y * c.y,
    z: clickOnFace.z + u.z * c.x + v.z * c.y,
  }));

  return {
    id: `manual-mod-${face.id}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
    roofFaceId: face.id,
    vertices3d: corners,
    wp: settings.moduleWp,
  };
}
