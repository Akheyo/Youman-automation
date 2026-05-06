/**
 * NativeBuildingLayer
 *
 * Rendert die Gebäudewände als MapLibre-`fill-extrusion`-Layer.
 * Dachflächen + Module übernimmt der ThreeBuildingLayer als echte
 * 3D-Schrägflächen (fill-extrusion kann nur Cuboid-Mauern, keine Schrägen).
 */

import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { DetectedBuilding } from "@/types/solar";

const SRC_WALLS = "youman-walls";
const LYR_WALLS = "youman-walls-extrusion";

type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon, Record<string, unknown>>;

const EMPTY_FC: FC = { type: "FeatureCollection", features: [] };

export class NativeBuildingLayer {
  constructor(private readonly map: MapLibreMap) {}

  /** Sources + Layers in den aktuellen Style hängen. Idempotent.
   *  Hinweis: Dachflächen + Module werden vom ThreeBuildingLayer als echte
   *  3D-Schrägflächen gerendert. Hier nur die Wände (fill-extrusion ist
   *  perfekt für Cuboid-Mauern, kann aber keine Schrägen). */
  install() {
    if (this.map.getSource(SRC_WALLS)) return; // bereits installiert

    this.map.addSource(SRC_WALLS, { type: "geojson", data: EMPTY_FC });

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
  }

  /** Layer + Source entfernen (z. B. vor Style-Wechsel). */
  remove() {
    if (this.map.getLayer(LYR_WALLS)) this.map.removeLayer(LYR_WALLS);
    if (this.map.getSource(SRC_WALLS)) this.map.removeSource(SRC_WALLS);
  }

  /** Aktualisiert die Wände. */
  setBuilding(b: DetectedBuilding) {
    this.setWallsFromBuilding(b);
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
    const src = this.map.getSource(SRC_WALLS) as GeoJSONSource | undefined;
    if (src) src.setData(fc);
  }
}

function estimateEaveHeight(b: DetectedBuilding): number {
  if (b.roofFaces.length === 0) return 5;
  let minZ = Infinity;
  for (const face of b.roofFaces) {
    for (const v of face.vertices3d) {
      if (v.z < minZ) minZ = v.z;
    }
  }
  return Number.isFinite(minZ) && minZ > 0 ? minZ : 5;
}
