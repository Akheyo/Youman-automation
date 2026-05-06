/**
 * Lod2RoofProvider
 *
 * Architektur-Provider für deutsche LoD2-Daten (3D-Gebäudemodelle aus
 * Vermessungs-Verwaltung der Bundesländer). LoD2 hat im Gegensatz zu OSM
 * echte 3D-Polygone der Dachflächen mit korrektem Pitch und Azimuth –
 * also die genaueste Quelle für Solarplanung in Deutschland.
 *
 * Datenquellen (Stand 2025/26):
 *   - NRW:  https://www.opengeodata.nrw.de/produkte/geobasis/3dg/
 *   - BY:   https://geodaten.bayern.de/  (LoD2-DE)
 *   - HH:   https://transparenz.hamburg.de/  (3D-Stadtmodell)
 *   - Bund: https://gdz.bkg.bund.de/  (LoD2-DE, teils kostenpflichtig)
 *
 * Format: typischerweise CityGML (XML) oder 3D Tiles. Die Polygone der
 * RoofSurface lassen sich direkt in unser RoofFace-Modell übersetzen.
 *
 * Architektur in dieser Klasse:
 *   - `Lod2DataSource` ist ein Plug-in-Punkt: jede Datenquelle (lokale
 *     CityGML-Datei, BKG-WFS, kommunaler 3D-Service) implementiert das
 *     Interface und liefert ein Lod2Building.
 *   - Lod2RoofProvider nimmt eine Source und mappt das Ergebnis auf
 *     unser DetectedBuilding.
 *   - Solange keine Source konfiguriert ist, wirft `detectRoof` und der
 *     ProviderFactory überspringt LoD2 → der OSM- oder Mock-Provider
 *     übernimmt nahtlos.
 *
 * TODO für echte Integration:
 *   1. CityGML-Parser (z. B. `citygml-utils` oder eigenes XML-Stream-Parsing)
 *   2. Tile-Download für die Region des Anfrage-Punkts
 *   3. Caching pro Tile (CityGML-Files sind groß – einmalig laden, lokal
 *      indizieren)
 *   4. Building-Lookup per räumlichem Index (z. B. R-Tree)
 */

import type {
  BuildingFootprint,
  DetectedBuilding,
  RoofFace,
  Vec3,
} from "@/types/solar";
import { polygonArea3D } from "@/lib/geometry/roofMath";
import type {
  RoofDetectionInput,
  RoofDetectionProvider,
} from "./roofDetectionProvider";

/* ----------------------------- Public API ----------------------------- */

export type Lod2RoofSurface = {
  /** Polygon-Eckpunkte in lokalen Metern um den Gebäudemittelpunkt. */
  vertices3d: Vec3[];
};

export type Lod2Building = {
  buildingId: string;
  /** Gebäudemittelpunkt in WGS84. */
  centerLng: number;
  centerLat: number;
  /** Footprint (Außenkanten) in WGS84. */
  footprint: BuildingFootprint;
  /** Dachflächen aus LoD2 RoofSurface-Elementen. */
  roofSurfaces: Lod2RoofSurface[];
  /** Optional, falls Quelle Höheninfo separat liefert. */
  eaveHeightM?: number;
  ridgeHeightM?: number;
};

export interface Lod2DataSource {
  readonly id: string;
  /** Liefert das nächstgelegene Gebäude oder null, falls außerhalb der Coverage. */
  fetchNearest(
    lat: number,
    lng: number,
    radiusM: number,
  ): Promise<Lod2Building | null>;
}

/* ----------------------------- Provider ----------------------------- */

export class Lod2RoofProvider implements RoofDetectionProvider {
  readonly name = "lod2";

  constructor(private readonly source: Lod2DataSource | null = null) {}

  async detectRoof(input: RoofDetectionInput): Promise<DetectedBuilding> {
    if (!this.source) {
      // Auch im Auto-Modus harmlos: ProviderFactory fällt auf OSM/Mock zurück.
      throw new Error(
        "LoD2-Datenquelle ist nicht konfiguriert. Plug-in eine Lod2DataSource ein (siehe src/lib/lod2/README.md).",
      );
    }

    const found = await this.source.fetchNearest(input.lat, input.lng, 50);
    if (!found) {
      throw new Error(
        `Kein LoD2-Gebäude in der Nähe (Source: ${this.source.id}).`,
      );
    }

    const roofFaces: RoofFace[] = found.roofSurfaces.map((s, idx) => {
      const areaM2 = polygonArea3D(s.vertices3d);
      return {
        id: `lod2-${found.buildingId}-${idx}`,
        label: `LoD2-Dachfläche ${idx + 1}`,
        vertices3d: s.vertices3d,
        // Pitch/Azimuth lassen sich aus den Vertices berechnen – siehe
        // roofMath.ts. Für den Stub-Pfad lassen wir 0 stehen, eine echte
        // Implementation ergänzt das.
        pitchDeg: 0,
        azimuthDeg: 0,
        areaM2,
        selected: true,
        confidence: 0.95,
        source: "lod2",
        metadata: {
          lod2SourceId: this.source!.id,
        },
      };
    });

    const totalRoofAreaM2 = roofFaces.reduce((s, f) => s + f.areaM2, 0);
    const selectedRoofAreaM2 = roofFaces
      .filter((f) => f.selected)
      .reduce((s, f) => s + f.areaM2, 0);

    return {
      buildingId: `lod2-${found.buildingId}`,
      address: input.address,
      center: { lng: found.centerLng, lat: found.centerLat },
      footprint: found.footprint,
      roofFaces,
      modules: [],
      source: "lod2",
      confidence: 0.95,
      metrics: {
        totalRoofAreaM2,
        selectedRoofAreaM2,
        moduleCount: 0,
        totalKwp: 0,
      },
      warnings: [
        `Daten aus LoD2-Quelle "${this.source.id}". Amtliche Vermessung der Bundesländer.`,
      ],
    };
  }
}
