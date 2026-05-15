/**
 * Baut einen Three.js-Group aus ModuleSlot-Daten. Wird sowohl von
 * `Building3DView` (lokale Szene) als auch vom `ThreeBuildingLayer`
 * (MapLibre Custom-Layer) genutzt, damit die Slot-Positionen in beiden
 * Views identisch sind.
 *
 * Eingabekoordinaten: `slot.corners` in lokalen Meterkoordinaten relativ
 * zum Gebäudezentrum – exakt dasselbe System wie `RoofFace.vertices3d`.
 * Die Group wird ohne weitere Transformation in die jeweilige Szene
 * gehängt; das Mercator-Mapping macht der `ThreeBuildingLayer` zur
 * Render-Zeit über seinen kombinierten Layer-Matrix-Pfad.
 */

import * as THREE from "three";

import type { ModuleSlot } from "@/types/solar";
import type { Materials } from "@/lib/map/materials";

export function buildSlotGroup(
  slots: ModuleSlot[],
  occupiedSlotIds: Set<string>,
  materials: Materials,
): THREE.Group {
  const group = new THREE.Group();
  group.userData = { kind: "slots" };
  for (const slot of slots) {
    if (occupiedSlotIds.has(slot.id)) continue;
    const [a, b, c, d] = slot.corners;
    if (!a || !b || !c || !d) continue;
    const positions = new Float32Array([
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      a.x, a.y, a.z,
      c.x, c.y, c.z,
      d.x, d.y, d.z,
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, materials.slotEmpty);
    mesh.userData = {
      kind: "slot",
      slotId: slot.id,
      roofFaceId: slot.roofFaceId,
    };
    mesh.renderOrder = 5;
    group.add(mesh);

    const edgePos = new Float32Array([
      a.x, a.y, a.z, b.x, b.y, b.z,
      b.x, b.y, b.z, c.x, c.y, c.z,
      c.x, c.y, c.z, d.x, d.y, d.z,
      d.x, d.y, d.z, a.x, a.y, a.z,
    ]);
    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
    const lines = new THREE.LineSegments(edgeGeom, materials.slotEmptyEdge);
    lines.userData = { kind: "slot-edge", slotId: slot.id };
    lines.renderOrder = 6;
    group.add(lines);
  }
  return group;
}

export function disposeSlotGroup(group: THREE.Group) {
  group.traverse((obj) => {
    const m = obj as THREE.Mesh | THREE.LineSegments;
    const geom = m.geometry as THREE.BufferGeometry | undefined;
    geom?.dispose();
  });
}
