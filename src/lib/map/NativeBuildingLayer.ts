/**
 * NativeBuildingLayer
 *
 * Rendert ein DetectedBuilding ausschließlich mit MapLibre-Bordmitteln –
 * keine Three.js, keine geteilten WebGL-Kontexte. Architektur-Trade-off
 * laut Spec ("Falls MapLibre Custom Layer mit Three.js komplex wird:
 * implementiere zuerst eine stabile Variante").
 *
 * Drei GeoJSON-Quellen + drei `fill-extrusion`-Layer:
 *   1. Wände       – Footprint extrudiert von 0 bis Eave-Höhe.
 *   2. Dachflächen – Pro Face ein Polygon, base = min(z), height = max(z).
 *                    Selektion steuert die Farbe (orange = aktiv).
 *   3. PV-Module   – Dünnes Extrusions-Plättchen knapp über der Dachfläche.
 *
 * Vorteile:
 *   - Keine WebGL-State-Kollision mit MapLibre (Tiles bleiben sichtbar).
 *   - Native Tiefen-/Lichtbehandlung von MapLibre.
 *   - Komplett über `setData` aktualisierbar, kein Layer-Rebuild nötig.
 *
 * Trade-off:
 *   - Eine echte Pitch-Geometrie (zwei sich treffende Dachflächen mit
 *     First) wird als Wedge-Extrusion approximiert. Visuell weniger
 *     detailreich als ein echtes 3D-Mesh, aber stabil.
 */

import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type {
  DetectedBuilding,
  PVModule,
  RoofFace,
  Vec3,
} from "@/types/solar";
import { localMetersToLngLat } from "@/lib/geometry/coordinates";

const SRC_WALLS = "youman-walls";
const SRC_ROOFS = "youman-roofs";
const SRC_MODULES = "youman-modules";

const LYR_WALLS = "youman-walls-extrusion";
const LYR_ROOFS = "youman-roofs-extrusion";
const LYR_MODULES = "youman-modules-extrusion";

type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon, Record<string, unknown>>;

const EMPTY_FC: FC = { type: "FeatureCollection", features: [] };

export class NativeBuildingLayer {
  constructor(private readonly map: MapLibreMap) {}

  /** Sources + Layers in den aktuellen Style hängen. Idempotent. */
  install() {
    if (this.map.getSource(SRC_WALLS)) return; // bereits installiert

    this.map.addSource(SRC_WALLS, { type: "geojson", data: EMPTY_FC });
    this.map.addSource(SRC_ROOFS, { type: "geojson", data: EMPTY_FC });
    this.map.addSource(SRC_MODULES, { type: "geojson", data: EMPTY_FC });

    this.map.addLayer({
      id: LYR_WALLS,
      type: "fill-extrusion",
      source: SRC_WALLS,
      paint: {
        "fill-extrusion-color": "#9ca3af", // grau
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.95,
        "fill-extrusion-vertical-gradient": true,
      },
    });

    this.map.addLayer({
      id: LYR_ROOFS,
      type: "fill-extrusion",
      source: SRC_ROOFS,
      paint: {
        "fill-extrusion-color": [
          "case",
          ["==", ["get", "selected"], true],
          "#2563eb", // blau – ausgewählt
          "#cbd5e1", // hellgrau – nicht ausgewählt
        ],
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.92,
        "fill-extrusion-vertical-gradient": false,
      },
    });

    this.map.addLayer({
      id: LYR_MODULES,
      type: "fill-extrusion",
      source: SRC_MODULES,
      paint: {
        "fill-extrusion-color": "#0f172a", // fast schwarz
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 1.0,
        "fill-extrusion-vertical-gradient": false,
      },
    });
  }

  /** Layers + Sources entfernen (z. B. vor Style-Wechsel). */
  remove() {
    [LYR_MODULES, LYR_ROOFS, LYR_WALLS].forEach((id) => {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    });
    [SRC_MODULES, SRC_ROOFS, SRC_WALLS].forEach((id) => {
      if (this.map.getSource(id)) this.map.removeSource(id);
    });
  }

  /** Aktualisiert alle drei Quellen in einem Rutsch. */
  setBuilding(b: DetectedBuilding) {
    this.setWallsFromBuilding(b);
    this.setRoofsFromFaces(b, b.roofFaces);
    this.setModulesFromList(b, b.modules);
  }

  /** Nur Module neu zeichnen – billig nach Settings-Änderung. */
  setModules(b: DetectedBuilding, modules: PVModule[]) {
    this.setModulesFromList(b, modules);
  }

  /** Nur Dachflächen-Status (Selektion) neu zeichnen. */
  setRoofFaces(b: DetectedBuilding, faces: RoofFace[]) {
    this.setRoofsFromFaces(b, faces);
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private setWallsFromBuilding(b: DetectedBuilding) {
    const fc: FC = { type: "FeatureCollection", features: [] };
    if (b.footprint && b.footprint.vertices.length >= 3) {
      const eave = estimateEaveHeight(b);
      const ring: GeoJSON.Position[] = b.footprint.vertices.map((p) => [
        p.lng,
        p.lat,
      ]);
      // Polygon-Ring schließen.
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        ring.push([first[0], first[1]]);
      }
      fc.features.push({
        type: "Feature",
        properties: { base: 0, height: eave },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    this.setData(SRC_WALLS, fc);
  }

  private setRoofsFromFaces(b: DetectedBuilding, faces: RoofFace[]) {
    const fc: FC = { type: "FeatureCollection", features: [] };
    for (const face of faces) {
      if (face.vertices3d.length < 3) continue;
      const ring = projectRing(face.vertices3d, b.center.lng, b.center.lat);
      const zs = face.vertices3d.map((v) => v.z);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      // Mindesthöhe von 5 cm, damit MapLibre überhaupt eine Fläche zeichnet.
      const height = Math.max(maxZ, minZ + 0.05);
      fc.features.push({
        type: "Feature",
        properties: {
          id: face.id,
          base: minZ,
          height,
          selected: face.selected,
        },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    this.setData(SRC_ROOFS, fc);
  }

  private setModulesFromList(b: DetectedBuilding, modules: PVModule[]) {
    const fc: FC = { type: "FeatureCollection", features: [] };
    for (const mod of modules) {
      if (mod.vertices3d.length < 3) continue;
      const ring = projectRing(mod.vertices3d, b.center.lng, b.center.lat);
      const zMax = Math.max(...mod.vertices3d.map((v) => v.z));
      // Plättchen 8 cm dick, 5 cm über der Dachfläche → kein Z-Fighting.
      fc.features.push({
        type: "Feature",
        properties: { id: mod.id, base: zMax + 0.05, height: zMax + 0.13 },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    this.setData(SRC_MODULES, fc);
  }

  private setData(sourceId: string, data: FC) {
    const src = this.map.getSource(sourceId) as GeoJSONSource | undefined;
    if (src) src.setData(data);
  }
}

function projectRing(
  vertices: Vec3[],
  centerLng: number,
  centerLat: number,
): GeoJSON.Position[] {
  const ring: GeoJSON.Position[] = vertices.map((v) => {
    const ll = localMetersToLngLat(v.x, v.y, centerLng, centerLat);
    return [ll.lng, ll.lat];
  });
  // Polygon schließen.
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function estimateEaveHeight(b: DetectedBuilding): number {
  if (b.roofFaces.length === 0) return 5;
  let minZ = Infinity;
  for (const face of b.roofFaces) {
    for (const v of face.vertices3d) {
      if (v.z < minZ) minZ = v.z;
    }
  }
  // Fallback, falls Dachflächen ohne Z geliefert werden.
  return Number.isFinite(minZ) && minZ > 0 ? minZ : 5;
}
