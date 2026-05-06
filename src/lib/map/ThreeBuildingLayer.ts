/**
 * ThreeBuildingLayer
 *
 * Custom-Layer für MapLibre GL JS, das ein gemeinsames Three.js-Setup
 * zur Verfügung stellt und ein DetectedBuilding (Gebäude, Dachflächen,
 * PV-Module) georeferenziert auf der Karte rendert.
 *
 * Architektur:
 *   - Three.js Renderer teilt sich den WebGL-Kontext mit MapLibre.
 *   - Pro Frame setzt MapLibre die Projektionsmatrix; wir komponieren sie
 *     mit der Modelltransformation (Mercator-Origin, Y-Flip, Meterskalierung)
 *     und rendern unsere Szene.
 *   - Vec3-Koordinaten in unseren Datenstrukturen sind lokale Meter relativ
 *     zum Gebäudezentrum (X = Ost, Y = Nord, Z = Höhe). Das passt nach
 *     `scale(s, -s, s)` direkt in Mercator-Koordinaten.
 */

import * as THREE from "three";
import maplibregl from "maplibre-gl";
import type {
  CustomLayerInterface,
  CustomRenderMethod,
  Map as MapLibreMap,
} from "maplibre-gl";

import type {
  DetectedBuilding,
  LngLat,
  PVModule,
  RoofFace,
  Vec3,
} from "@/types/solar";
import { lngLatToLocalMeters } from "@/lib/geometry/coordinates";
import { createMaterials, disposeMaterials, type Materials } from "./materials";

type LayerOptions = {
  showEdges?: boolean;
};

export class ThreeBuildingLayer implements CustomLayerInterface {
  readonly id: string = "youman-three-building";
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene = new THREE.Scene();
  private camera: THREE.Camera = new THREE.Camera();
  private buildingGroup: THREE.Group = new THREE.Group();
  private materials: Materials = createMaterials();

  private origin: { mx: number; my: number; mz: number; meterScale: number } = {
    mx: 0,
    my: 0,
    mz: 0,
    meterScale: 1,
  };

  constructor(private readonly options: LayerOptions = { showEdges: true }) {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(0.5, 1.2, 0.7);
    this.scene.add(sun);
    this.scene.add(this.buildingGroup);
  }

  /* ------------------------------------------------------------------ */
  /* CustomLayerInterface                                               */
  /* ------------------------------------------------------------------ */

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl as WebGLRenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
    // WICHTIG: Seit Three r155 ist `outputColorSpace` per Default `SRGBColorSpace`.
    // Das verändert das Framebuffer-Encoding, das MapLibre erwartet, und führt
    // dazu, dass die Basemap nach Three's Frame unsichtbar wird (Bug-Symptom:
    // weißer Map-Bereich, Tiles werden geladen, aber nicht angezeigt).
    // LinearSRGBColorSpace stellt das ursprüngliche Verhalten her.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  }

  onRemove() {
    this.clear();
    disposeMaterials(this.materials);
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  render: CustomRenderMethod = (gl, matrix) => {
    if (!this.renderer || !this.map) return;

    // matrix kommt als gl-matrix `mat4` (Float32Array), Three.js nimmt
    // jedes ArrayLike<number> entgegen.
    const m = new THREE.Matrix4().fromArray(matrix as unknown as number[]);
    const s = this.origin.meterScale;
    const local = new THREE.Matrix4()
      .makeTranslation(this.origin.mx, this.origin.my, this.origin.mz)
      // Y-Achse ist in Mercator nach Süden positiv → Flip.
      .scale(new THREE.Vector3(s, -s, s));

    this.camera.projectionMatrix = m.multiply(local);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    // GL-State, der MapLibre's Folge-Draws beeinflusst, defensiv zurücksetzen.
    // Three deaktiviert TEXTURE_2D-Bindings nicht zuverlässig, was bei der
    // nächsten MapLibre-Pass die Raster-Layer schwarz/leer aussehen lässt.
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.map.triggerRepaint();
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */

  setBuilding(building: DetectedBuilding) {
    this.clear();
    this.setOriginFromLngLat(building.center);

    // Wände werden vom NativeBuildingLayer (MapLibre fill-extrusion) gemacht;
    // hier nur die schräge Geometrie, die fill-extrusion nicht beherrscht.

    // Dachflächen als echte 3D-Schrägflächen.
    for (const face of building.roofFaces) {
      const meshes = this.buildRoofFace(face);
      meshes.forEach((m) => this.buildingGroup.add(m));
    }

    // PV-Module liegen geneigt auf den Dachflächen.
    for (const mod of building.modules) {
      const mesh = this.buildModule(mod);
      this.buildingGroup.add(mesh);
    }

    this.map?.triggerRepaint();
  }

  /** Aktualisiert nur die Module (z. B. nach Auswahl-/Settings-Änderung). */
  setModules(modules: PVModule[]) {
    // Module = Kinder mit userData.kind === "module"
    const toRemove: THREE.Object3D[] = [];
    this.buildingGroup.traverse((obj) => {
      if (obj.userData?.kind === "module") toRemove.push(obj);
    });
    toRemove.forEach((o) => this.buildingGroup.remove(o));
    for (const mod of modules) {
      this.buildingGroup.add(this.buildModule(mod));
    }
    this.map?.triggerRepaint();
  }

  /** Aktualisiert nur die Auswahl/Hervorhebung der Dachflächen. */
  setRoofFaces(faces: RoofFace[]) {
    const toRemove: THREE.Object3D[] = [];
    this.buildingGroup.traverse((obj) => {
      if (obj.userData?.kind === "roof") toRemove.push(obj);
    });
    toRemove.forEach((o) => this.buildingGroup.remove(o));
    for (const face of faces) {
      const meshes = this.buildRoofFace(face);
      meshes.forEach((m) => this.buildingGroup.add(m));
    }
    this.map?.triggerRepaint();
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private setOriginFromLngLat(center: LngLat) {
    const merc = maplibregl.MercatorCoordinate.fromLngLat(
      { lng: center.lng, lat: center.lat },
      0,
    );
    this.origin = {
      mx: merc.x,
      my: merc.y,
      mz: merc.z ?? 0,
      meterScale: merc.meterInMercatorCoordinateUnits(),
    };
  }

  private footprintToLocalMeters(b: DetectedBuilding): Vec3[] | null {
    if (!b.footprint || b.footprint.vertices.length < 3) return null;
    return b.footprint.vertices.map((p) => {
      const m = lngLatToLocalMeters(p.lng, p.lat, b.center.lng, b.center.lat);
      return { x: m.x, y: m.y, z: 0 };
    });
  }

  private estimateEaveHeight(b: DetectedBuilding): number {
    if (b.roofFaces.length === 0) return 0;
    let minZ = Infinity;
    for (const face of b.roofFaces) {
      for (const v of face.vertices3d) {
        if (v.z < minZ) minZ = v.z;
      }
    }
    return Number.isFinite(minZ) ? minZ : 0;
  }

  private buildWalls(footprint: Vec3[], baseZ: number, topZ: number): THREE.Object3D {
    const group = new THREE.Group();
    group.userData.kind = "walls";
    const positions: number[] = [];
    const normals: number[] = [];

    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i]!;
      const b = footprint[(i + 1) % footprint.length]!;
      // Wandsegment a→b mit zwei Dreiecken.
      // Vertices: a_bottom, b_bottom, b_top, a_top
      const ab = { x: b.x - a.x, y: b.y - a.y };
      const len = Math.hypot(ab.x, ab.y) || 1;
      const nx = ab.y / len;
      const ny = -ab.x / len; // nach außen (rechte Hand bzgl. Reihenfolge)

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
    group.add(new THREE.Mesh(geom, this.materials.building));

    if (this.options.showEdges) {
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
      group.add(new THREE.LineSegments(edgeGeom, this.materials.edges));
    }
    return group;
  }

  private buildRoofFace(face: RoofFace): THREE.Object3D[] {
    const verts = face.vertices3d;
    if (verts.length < 3) return [];

    const positions: number[] = [];
    // Fan-Triangulation (ausreichend für konvexe Dachflächen).
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
      ? this.materials.roofSelected
      : this.materials.roofUnselected;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { kind: "roof", roofFaceId: face.id };

    const out: THREE.Object3D[] = [mesh];

    if (this.options.showEdges) {
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
      const lines = new THREE.LineSegments(edgeGeom, this.materials.edges);
      lines.userData = { kind: "roof", roofFaceId: face.id };
      out.push(lines);
    }
    return out;
  }

  private buildModule(mod: PVModule): THREE.Object3D {
    const verts = mod.vertices3d;
    const lift = 0.06; // leichter Abstand zur Dachfläche → kein Z-Fighting
    const positions: number[] = [];
    // Fan-Triangulation auf 4 Eckpunkten = 2 Dreiecke.
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
    const mesh = new THREE.Mesh(geom, this.materials.module);
    mesh.userData = { kind: "module", moduleId: mod.id };
    return mesh;
  }

  private clear() {
    while (this.buildingGroup.children.length > 0) {
      const child = this.buildingGroup.children.pop()!;
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
  }
}
