/**
 * ThreeBuildingLayer
 *
 * Custom-Layer für MapLibre GL JS, das ein gemeinsames Three.js-Setup
 * zur Verfügung stellt und ein DetectedBuilding (Gebäude, Dachflächen,
 * PV-Module) georeferenziert auf der Karte rendert.
 *
 * Geometrie wird über `buildBuildingGroup` aus `@/lib/buildingGeometry`
 * gebaut – exakt derselbe Code-Pfad, den auch die standalone
 * `Building3DView` nutzt. Single source of truth.
 *
 * Architektur:
 *   - Three.js Renderer teilt sich den WebGL-Kontext mit MapLibre.
 *   - Pro Frame setzt MapLibre die Projektionsmatrix; wir komponieren sie
 *     mit der Modelltransformation (Mercator-Origin, Y-Flip, Meterskalierung)
 *     und rendern unsere Szene.
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
  ModuleSlot,
  PVModule,
  RoofFace,
} from "@/types/solar";
import {
  buildBuildingGroup,
  disposeBuildingGroup,
} from "@/lib/buildingGeometry";
import { buildSlotGroup, disposeSlotGroup } from "@/lib/slotGeometry";
import { createMaterials, disposeMaterials, type Materials } from "./materials";

export type LayerHit =
  | { kind: "slot"; slotId: string }
  | { kind: "module"; slotId?: string; moduleId: string }
  | { kind: "roof"; roofFaceId: string };

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
  private slotsGroup: THREE.Group | null = null;
  private materials: Materials = createMaterials();
  private currentBuilding: DetectedBuilding | null = null;
  /** Speichert die letzte Render-Matrix (Map-Projection × Local-Transform).
   *  Wird vom hitTest invertiert, um Screen-Klicks auf eine Ray im lokalen
   *  Meter-Koordinatensystem abzubilden. */
  private lastRenderMatrix: THREE.Matrix4 | null = null;

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
    // dazu, dass die Basemap nach Three's Frame unsichtbar wird.
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

    const m = new THREE.Matrix4().fromArray(matrix as unknown as number[]);
    const s = this.origin.meterScale;
    const local = new THREE.Matrix4()
      .makeTranslation(this.origin.mx, this.origin.my, this.origin.mz)
      // Y-Achse ist in Mercator nach Süden positiv → Flip.
      .scale(new THREE.Vector3(s, -s, s));

    const combined = m.multiply(local);
    this.lastRenderMatrix = combined.clone();
    this.camera.projectionMatrix = combined;
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    // GL-State, der MapLibre's Folge-Draws beeinflusst, defensiv zurücksetzen.
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.map.triggerRepaint();
  };

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */

  setBuilding(building: DetectedBuilding) {
    this.currentBuilding = building;
    this.clear();
    this.setOriginFromLngLat(building.center);

    // Wände werden vom NativeBuildingLayer (fill-extrusion) gemacht;
    // hier nur die schräge Geometrie, die fill-extrusion nicht beherrscht.
    const fresh = buildBuildingGroup(building, this.materials, {
      mode: "mercator",
      includeWalls: false,
      showEdges: this.options.showEdges ?? true,
    });
    // Children in den vorhandenen, bereits zur Szene gehörenden Group hängen.
    while (fresh.children.length > 0) {
      this.buildingGroup.add(fresh.children[0]!);
    }

    this.map?.triggerRepaint();
  }

  /** Aktualisiert nur die Module. */
  setModules(modules: PVModule[]) {
    if (!this.currentBuilding) return;
    this.currentBuilding = { ...this.currentBuilding, modules };
    this.setBuilding(this.currentBuilding);
  }

  /** Aktualisiert die Auswahl/Hervorhebung der Dachflächen. */
  setRoofFaces(faces: RoofFace[]) {
    if (!this.currentBuilding) return;
    this.currentBuilding = { ...this.currentBuilding, roofFaces: faces };
    this.setBuilding(this.currentBuilding);
  }

  /**
   * Setzt die sichtbaren Modul-Slots. Eingabe `slots` sind die kompletten
   * Slot-Geometrien in lokalen Metern (Vec3 relativ zum Gebäudezentrum);
   * `occupiedSlotIds` filtert die belegten Positionen aus.
   */
  setSlots(slots: ModuleSlot[], occupiedSlotIds: Set<string>) {
    // Alte Slot-Group entfernen.
    if (this.slotsGroup) {
      this.buildingGroup.remove(this.slotsGroup);
      disposeSlotGroup(this.slotsGroup);
      this.slotsGroup = null;
    }
    if (slots.length === 0) {
      this.map?.triggerRepaint();
      return;
    }
    const group = buildSlotGroup(slots, occupiedSlotIds, this.materials);
    this.buildingGroup.add(group);
    this.slotsGroup = group;
    this.map?.triggerRepaint();
  }

  /**
   * Wandelt einen Klick auf der Karte in einen Treffer auf einen Slot, ein
   * Modul oder eine Dachfläche um. Nutzt die zuletzt gerenderte
   * Projection-Matrix, um aus dem NDC-Punkt eine Ray im lokalen
   * Meter-Koordinatensystem zu rekonstruieren.
   */
  hitTest(point: { x: number; y: number }): LayerHit | null {
    if (!this.map || !this.lastRenderMatrix) return null;
    const canvas = this.map.getCanvas();
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const ndcX = (point.x / w) * 2 - 1;
    const ndcY = -((point.y / h) * 2 - 1);

    const inv = this.lastRenderMatrix.clone().invert();
    const near = new THREE.Vector4(ndcX, ndcY, -1, 1).applyMatrix4(inv);
    if (near.w !== 0) near.divideScalar(near.w);
    const far = new THREE.Vector4(ndcX, ndcY, 1, 1).applyMatrix4(inv);
    if (far.w !== 0) far.divideScalar(far.w);

    const origin = new THREE.Vector3(near.x, near.y, near.z);
    const dir = new THREE.Vector3(
      far.x - near.x,
      far.y - near.y,
      far.z - near.z,
    ).normalize();

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.copy(origin);
    raycaster.ray.direction.copy(dir);
    raycaster.far = 1e6;

    const hits = raycaster.intersectObject(this.buildingGroup, true);

    // Reihenfolge der Priorität: Slot > Modul > Dach.
    const slotHit = hits.find(
      (hh) => (hh.object as THREE.Mesh).isMesh && hh.object.userData?.kind === "slot",
    );
    if (slotHit) {
      return { kind: "slot", slotId: slotHit.object.userData.slotId as string };
    }
    const moduleHit = hits.find(
      (hh) => (hh.object as THREE.Mesh).isMesh && hh.object.userData?.kind === "module",
    );
    if (moduleHit?.object.userData.slotId) {
      return {
        kind: "module",
        moduleId: moduleHit.object.userData.moduleId as string,
        slotId: moduleHit.object.userData.slotId as string,
      };
    }
    // Modul ohne slotId (Alt-Daten) blockt nicht den Roof-Klick: wir suchen
    // in den Hits weiter nach der Dachfläche und öffnen ihr Detail-Modal.
    const roofHit = hits.find(
      (hh) => (hh.object as THREE.Mesh).isMesh && hh.object.userData?.kind === "roof",
    );
    if (roofHit) {
      return {
        kind: "roof",
        roofFaceId: roofHit.object.userData.roofFaceId as string,
      };
    }
    return null;
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

  private clear() {
    while (this.buildingGroup.children.length > 0) {
      const child = this.buildingGroup.children.pop()!;
      if (child instanceof THREE.Group) {
        disposeBuildingGroup(child);
      } else if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
    this.slotsGroup = null;
  }
}
