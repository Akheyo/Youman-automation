/**
 * Lod2RoofProvider – Stub
 *
 * Vorbereitete Architektur für die spätere Auswertung deutscher
 * 3D-Gebäudemodelle (LoD2). Aktuell nicht aktiv – aktivierbar sobald
 * eine LoD2-Pipeline bereitsteht.
 *
 * Zielarchitektur:
 *   1. Eingabe: Lat/Lng eines Gebäudes (oder Adresse).
 *   2. Hintergrund-Pipeline lädt CityGML / 3D Tiles / GeoJSON aus
 *      dem entsprechenden Bundesland (z. B. NRW, BY, BW).
 *   3. Server-seitig wird je Gebäude die Dachgeometrie extrahiert
 *      (RoofSurface in CityGML LoD2 enthält bereits Polygone).
 *   4. Polygone werden ins lokale Meter-System um den Gebäudemittelpunkt
 *      umgerechnet und als RoofFace[] zurückgegeben.
 *   5. Die Visualisierung sieht keinen Unterschied zu Mock- oder
 *      Google-Solar-Daten, da alles auf das DetectedBuilding-Modell
 *      normalisiert wird.
 *
 * Siehe `src/lib/lod2/README.md` für Details.
 */

import type { DetectedBuilding } from "@/types/solar";
import type {
  RoofDetectionInput,
  RoofDetectionProvider,
} from "./roofDetectionProvider";

export class Lod2RoofProvider implements RoofDetectionProvider {
  readonly name = "lod2";

  async detectRoof(_input: RoofDetectionInput): Promise<DetectedBuilding> {
    void _input;
    // Bewusst noch nicht implementiert. Der providerFactory soll diesen
    // Provider derzeit gar nicht erst auswählen.
    throw new Error(
      "Lod2RoofProvider ist noch nicht implementiert. Aktivieren, sobald eine LoD2-Pipeline bereitsteht (siehe src/lib/lod2/README.md).",
    );
  }
}
