# LoD2-Anbindung (Stub)

Dieser Ordner ist Platzhalter für die spätere Auswertung deutscher
3D-Gebäudemodelle (Level of Detail 2 – LoD2).

## Ziel

LoD2-Datensätze enthalten **echte Polygon-Eckpunkte** der Dachflächen
(`bldg:RoofSurface` in CityGML), nicht nur Statistiken. Damit kann der
Solarplaner das Dach einer Adresse exakt rekonstruieren – inklusive
Gauben, Anbauten und nicht-rechteckigen Grundrissen.

## Datenquellen

- **NRW**: 3D-Gebäudemodelle des Landes NRW (CityGML / 3D Tiles), Open Data.
- **Bayern, BW, …**: Vergleichbare Landesgeobasisdaten.
- **Deutschland gesamt**: über die Geobasis-Schnittstellen der Länder
  (zentrale Aggregatoren werden ergänzt).

## Pipeline (geplant)

1. Bounding-Box um den Gebäudestandort abfragen.
2. CityGML 2.0 / 3.0 herunterladen (oder eigenes 3D-Tiles-Tileset hosten).
3. CityGML parsen, je Gebäude alle `RoofSurface`-Polygone extrahieren.
4. Polygone vom CRS (z. B. ETRS89/UTM Zone 32N) ins lokale Meter-System
   relativ zum Gebäudemittelpunkt projizieren.
5. Aus den 3D-Polygonen Pitch, Azimuth und Fläche per `roofMath.ts`
   berechnen.
6. Als `RoofFace[]` mit `source: "lod2"` an das Frontend zurückgeben.

## Schnittstelle

`Lod2RoofProvider` implementiert `RoofDetectionProvider` und erfüllt
denselben Vertrag wie `MockRoofDetectionProvider` und
`GoogleSolarRoofProvider`. Die Visualisierung muss nichts ändern, sobald
echte LoD2-Geometrie verfügbar ist – sie sieht dasselbe `DetectedBuilding`.

## Status

**Nicht implementiert.** `Lod2RoofProvider.detectRoof` wirft aktuell einen
`Error`. Der `providerFactory` wählt LoD2 nicht aus, solange die
Umgebungsvariable `LOD2_TILESET_URL` nicht gesetzt ist – und auch dann
muss die Implementierung erst vervollständigt werden.
