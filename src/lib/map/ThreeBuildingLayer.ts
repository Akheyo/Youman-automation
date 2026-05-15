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
  PVModule,
  RoofFace,
} from "@/types/solar";
import {
  buildBuildingGroup,
  disposeBuildingGroup,
} from "@/lib/buildingGeometry";
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
  private currentBuilding: DetectedBuilding | null = null;

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

    this.camera.projectionMatrix = m.multiply(local);
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
  }
}
