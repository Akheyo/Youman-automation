# Youman 3D-Solarplaner – Prototyp

Ein professioneller 3D-Solarplaner-Prototyp mit
**MapLibre GL JS** + **Three.js** als 3D-Karte, einer
**Provider-Architektur** für Dachflächen-Erkennung
(Mock / Google Solar API / LoD2-Stub) und einem **vereinheitlichten
Datenmodell** auf Basis von `RoofFace`.

> Ziel des Prototyps ist die Daten- und Visualisierungsarchitektur, nicht die
> finale Wirtschaftlichkeitsberechnung. PV-Module werden korrekt platziert und
> Kennzahlen (Anzahl, kWp) angezeigt – aber Erträge, Verschattung etc. sind
> noch nicht Bestandteil dieses MVPs.

---

## Schnellstart

```bash
npm install
npm run dev
```

Anschließend `http://localhost:3000` im Browser öffnen. Beim ersten Aufruf
wird automatisch ein Demo-Gebäude (Mock-Provider) geladen, sodass die App
**ohne API-Keys** sofort sichtbare 3D-Dachflächen mit PV-Modulen zeigt.

---

## Was die App tut

1. Du gibst eine **Adresse** ein (oder klickst „Demo laden“).
2. Das Backend **geocodiert** die Adresse (Google API, falls Key gesetzt –
   sonst Mock-Geocoding mit deutschen Großstädten).
3. Der **`RoofDetectionProvider`** wird gewählt (`google-solar`, sonst
   `mock`) und liefert ein normalisiertes **`DetectedBuilding`** mit
   `RoofFace[]`, `PVModule[]`, Footprint, Center, Confidence usw.
4. Das Frontend rendert das Gebäude in einer **3D-Karte** (MapLibre als
   Basemap + Three.js Custom Layer für die Geometrie).
5. Du wählst Dachflächen aus / ab und passt die **Modul-Einstellungen** an.
   Module werden live neu platziert und Kennzahlen (Anzahl, kWp) aktualisieren
   sich.

---

## Architektur-Diagramm

```
                ┌────────────────────┐
                │  Frontend (Next.js)│
                │  ─ SolarPlanner    │
                │  ─ MapView         │
                │     (MapLibre +    │
                │      Three.js)     │
                │  ─ Sidebar         │
                └─────────┬──────────┘
                          │ POST /api/detect-roof
                          │ POST /api/geocode
                          ▼
                ┌────────────────────┐
                │  Backend (Next.js  │
                │  App Router API)   │
                └─────────┬──────────┘
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
   ┌─────────────────────┐   ┌─────────────────────┐
   │  providerFactory    │   │  googleGeocoding    │
   └────────┬────────────┘   └─────────────────────┘
            │
   ┌────────┼─────────────┬──────────────────┐
   ▼        ▼             ▼                  ▼
┌──────┐ ┌────────┐ ┌──────────────────┐ ┌─────────────────┐
│ Mock │ │ Google │ │ Lod2RoofProvider │ │ (manuell, später│
│      │ │ Solar  │ │   (Stub)         │ │  Editor)        │
└──┬───┘ └────┬───┘ └──────────┬───────┘ └─────────────────┘
   │          │                │
   └──────────┼────────────────┘
              ▼
      ┌────────────────────────────────┐
      │   DetectedBuilding             │
      │   (RoofFace[], PVModule[],     │
      │    Footprint, Center, Source)  │
      └────────────────────────────────┘
```

**Trennung der Verantwortlichkeiten:**

| Schicht                 | Aufgabe                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `MapLibre GL JS`        | Basemap, Kamera, Pitch / Bearing / Zoom                          |
| `Three.js` Custom Layer | 3D-Visualisierung (Gebäude, Dachflächen, PV-Module)              |
| `Google Solar API`      | Schnelle automatische Dach-/Solarinfos                           |
| `LoD2 (Deutschland)`    | Spätere genaue Dachform-Geometrie aus amtlichen 3D-Modellen      |
| `Backend / Provider`    | Vereinheitlicht alle Quellen zu `RoofFace` und `DetectedBuilding`|

**Wichtig:** Die Visualisierung weiß **niemals** ob es sich um ein
Sattel-, Walm-, Flach- oder Pultdach handelt. Sie bekommt nur ein
generisches `RoofFace[]` mit `vertices3d`, `pitchDeg`, `azimuthDeg`,
`areaM2`, `selected`, …

---

## Environment Variables

Lege eine Datei `.env.local` an (oder kopiere `.env.example`).

```bash
# Server-side: Geocoding (optional, sonst Mock)
GOOGLE_MAPS_API_KEY=

# Server-side: Google Solar API für RoofDetection (optional, sonst Mock)
GOOGLE_SOLAR_API_KEY=

# Browser: Raster-Tile-URL für die Basemap (z. B. Mapbox / MapTiler / Esri)
# Wenn leer, wird OSM-Carto als heller Fallback genutzt.
NEXT_PUBLIC_TILE_URL=
NEXT_PUBLIC_TILE_ATTRIBUTION=
```

### Google Maps Geocoding einrichten

1. In der Google Cloud Console ein Projekt anlegen.
2. „Geocoding API“ aktivieren und einen API-Key erstellen.
3. Den Key in `.env.local` als `GOOGLE_MAPS_API_KEY` eintragen.
4. Den Key serverseitig auf die Geocoding-API beschränken – er wird nie
   ans Frontend ausgeliefert.

### Google Solar API einrichten

1. Im selben Projekt „Solar API“ aktivieren (separat freischalten).
2. API-Key entweder den gleichen wie für Geocoding nutzen oder einen
   eigenen erstellen.
3. Als `GOOGLE_SOLAR_API_KEY` in `.env.local` eintragen.
4. Sobald gesetzt, wählt der `providerFactory` automatisch
   `GoogleSolarRoofProvider` als Dachdetektion.

### Satellitentiles (Basemap)

`NEXT_PUBLIC_TILE_URL` muss eine Tile-Vorlage mit `{z}/{x}/{y}` sein. Beispiele:

```bash
# MapTiler Hybrid (Konto + Key nötig)
NEXT_PUBLIC_TILE_URL=https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=YOUR_KEY
NEXT_PUBLIC_TILE_ATTRIBUTION=© MapTiler © OpenStreetMap

# Esri World Imagery (für Demo / Prototypen, eigene Lizenz beachten)
NEXT_PUBLIC_TILE_URL=https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
NEXT_PUBLIC_TILE_ATTRIBUTION=Tiles © Esri
```

Ohne Konfiguration zeigt die App eine helle OSM-Karte als Fallback und
einen dezenten Hinweis links oben.

---

## Provider im Detail

### MockRoofDetectionProvider

Liefert für jede Eingabe ein deterministisches `DetectedBuilding` mit echten
3D-Vertices. Unterstützt:

- Satteldach (2 RoofFaces)
- Walmdach (4 RoofFaces)
- Flachdach (1 RoofFace)
- Pultdach (1 RoofFace)
- Komplex mit Anbau (5–8 RoofFaces)

Über den Sidebar-Button **„Demo-Gebäude wechseln“** kann man durch alle
Typen rotieren – ideal zum Prüfen, dass die Visualisierung wirklich
nur mit `RoofFace[]` arbeitet.

### GoogleSolarRoofProvider

- Ruft `solar.googleapis.com/v1/buildingInsights:findClosest` auf.
- Liest `roofSegmentStats` (Pitch, Azimuth, Fläche, Bounding-Box,
  `planeHeightAtCenterMeters`, Center).
- **Approximiert** die Dachflächen als geneigte Rechtecke (Google liefert
  keine echten Polygon-Eckpunkte). Die Approximation ist in
  `metadata.approximation = true` markiert; die Confidence wird reduziert.
- Wenn `solarPanels` zurückkommen, werden diese als zusätzliche Module
  übernommen (zur Plausibilisierung der Modulplatzierung).
- Fehler & fehlende Daten führen automatisch zum Fallback auf den
  Mock-Provider, mit Warnhinweis im UI.

### Lod2RoofProvider (Stub)

Vorbereitete Architektur für deutsche LoD2-Daten. Aktuell wirft der
Provider absichtlich einen `Error`. Siehe
[`src/lib/lod2/README.md`](src/lib/lod2/README.md) für die geplante
Pipeline (CityGML → RoofSurface-Polygone → `RoofFace`).

---

## Datenmodell (Auszug)

```ts
type RoofFace = {
  id: string;
  label: string;
  vertices3d: Vec3[];        // lokale Meter, Ursprung = Gebäudezentrum
  centerLngLat?: LngLat;
  pitchDeg: number;
  azimuthDeg: number;        // 0 = N, 90 = O, 180 = S, 270 = W
  areaM2: number;
  selected: boolean;
  confidence?: number;
  source: "mock" | "google-solar" | "lod2" | "manual";
  metadata?: Record<string, unknown>;
};

type DetectedBuilding = {
  buildingId: string;
  address?: string;
  center: LngLat;
  footprint?: BuildingFootprint;
  roofFaces: RoofFace[];
  modules: PVModule[];
  source: "mock" | "google-solar" | "lod2" | "manual";
  confidence?: number;
  metrics: {
    totalRoofAreaM2: number;
    selectedRoofAreaM2: number;
    moduleCount: number;
    totalKwp: number;
  };
  warnings?: string[];
};
```

Lokale Meter-Koordinaten:

- `X = Ost (positiv) / West (negativ)`
- `Y = Nord (positiv) / Süd (negativ)`
- `Z = Höhe in Metern über Boden`

Die Umrechnung in Mercator-Koordinaten der Karte erfolgt im
`ThreeBuildingLayer` über `maplibregl.MercatorCoordinate.fromLngLat`.

---

## Modulplatzierung

`placeModulesOnRoofFace(face, settings)` arbeitet **rein generisch** auf
den Vertices der RoofFace:

1. Flächennormale `n` per Newell-Methode.
2. Längste Kante als `u`-Achse (in der Dachebene), `v = n × u`.
3. 2D-Bounding-Box im (u, v)-System, abzüglich `edgeMarginM`.
4. Raster aus Modulrechtecken (Größe + `moduleGapM`).
5. Module, deren Mittelpunkt nicht im Polygon liegt, werden verworfen.
6. Eckpunkte zurück nach 3D, leichter Z-Lift gegen Z-Fighting.

Das funktioniert dadurch unabhängig vom Dachtyp – Satteldach, Walmdach,
Flachdach, Pultdach, …

---

## Bekannte Grenzen

- **Google Solar API ohne Polygone**: Dachflächen sind approximierte
  Rechtecke – die Form weicht vom realen Dach ab. LoD2-Daten oder eine
  spätere ML-basierte Polygon-Extraktion lösen das.
- **Modulplatzierung**: Mittelpunkts-Test gegen das Dachpolygon (kein
  exaktes Clipping). Für sehr konkave Polygone können Module zu nah am
  Rand sitzen.
- **Flachdach-Aufständerung**: Aktuell nur „flush“ (Module liegen flach
  auf). `ModuleSettings` ist so vorbereitet, dass `tilted-south` /
  `east-west` später ergänzt werden können.
- **Three.js Picking / Hover**: Die 3D-Geometrie ist sichtbar, aber noch
  nicht klickbar. Auswahl erfolgt über die Sidebar-Liste.
- **CRS-Approximation**: Equirectangular-Projektion auf Gebäude-Skala. Für
  Einzelgebäude < 200 m unkritisch; für stadtweite Datensätze müsste man
  pro Gebäude rechnen.

---

## Projektstruktur

```
src/
  app/
    page.tsx
    layout.tsx
    globals.css
    api/
      detect-roof/route.ts
      geocode/route.ts
  components/
    SolarPlanner.tsx     # State-Container, verbindet Map + Sidebar
    MapView.tsx          # MapLibre + ThreeBuildingLayer
    Sidebar.tsx          # Rechte Spalte
    RoofFaceList.tsx
    ModuleSettingsPanel.tsx
    MetricsPanel.tsx
    JsonDebugPanel.tsx
  lib/
    geometry/
      coordinates.ts     # lng/lat <-> lokale Meter, Rotation
      roofMath.ts        # Normale, Pitch, Azimuth, Polygonfläche
      modulePlacement.ts # generischer Modul-Raster-Algorithmus
      mockRoofs.ts       # 5 Mock-Dachgeometrien
    providers/
      roofDetectionProvider.ts     # Interface
      mockRoofDetectionProvider.ts
      googleSolarRoofProvider.ts
      lod2RoofProvider.ts          # Stub
      providerFactory.ts
    map/
      ThreeBuildingLayer.ts        # MapLibre CustomLayer + Three.js
      materials.ts
    api/
      googleGeocoding.ts
    lod2/
      README.md
  types/
    solar.ts
```

---

## Nächste Schritte

- LoD2-Pipeline implementieren (CityGML / 3D Tiles → RoofFace).
- Three.js-Picking für Klick/Hover auf Dachflächen.
- Modul-Clipping gegen das vollständige Polygon (statt Mittelpunkts-Test).
- Reihenabstand & Aufständerung für Flachdach (`tilted-south`,
  `east-west`).
- Verschattungs-/Ertragsberechnung mit PVGIS / Google Solar Insights.
- Export nach JSON / DXF / 3D-PDF.
