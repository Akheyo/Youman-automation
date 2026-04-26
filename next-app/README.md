# PV-Konfigurator (Next.js + Mapbox)

Production-ready Photovoltaik-Konfigurator: User gibt eine Adresse ein, das System erkennt das Gebäude, zeichnet seinen Footprint auf einer 3D-Karte und legt automatisch ein Solarmodul-Raster darauf.

## Stack

| Layer | Tech |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Sprache | TypeScript (strict) |
| Karte | Mapbox GL JS 3 + 3D-Buildings-Layer |
| Polygon-Bearbeitung | mapbox-gl-draw |
| Geo-Mathe | Turf.js |
| API | Next.js Route Handlers (Node) |
| Datenquellen | Mapbox Geocoding · OSM Overpass |
| PDF | jsPDF + html2canvas |

## Features

- **Adress-Suche** mit Debounce (250 ms) → Mapbox Geocoding über `/api/geocode` proxied (Token bleibt server-seitig).
- **Gebäude-Erkennung** — Overpass-API liefert OSM-Footprints, Turf wählt das Polygon das die Adresse enthält bzw. das nächstgelegene.
- **Polygon-Rendering** auf der Karte mit Outline + halbtransparenter Füllung.
- **Flächenberechnung** mit `turf.area` in m² (sphärisch korrekt).
- **Modul-Raster** rotiert das Polygon erst auf seine längste Kante, dann fittet es 1,7 × 1,1 m Module via `turf.booleanWithin`. Setback 0,5 m, Modulklemmen-Gap 5 cm.
- **Sidebar** zeigt Adresse, Dachfläche, Modulanzahl, kWp und (Bonus) Jahresertrag.
- **Bonus**: Manuelle Polygon-Bearbeitung via mapbox-gl-draw, Tilt + Azimut-Slider, PDF-Export.
- **Performance**: Mapbox wird via `next/dynamic({ssr:false})` lazy-geladen, Search ist debounced, Geocoding-Antworten werden 5 Min am Edge gecached.

## Projekt-Struktur

```
next-app/
├── app/
│   ├── api/
│   │   ├── buildings/route.ts   # Overpass-Proxy (Server)
│   │   └── geocode/route.ts     # Mapbox-Geocoding-Proxy (Server)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # rendert <PVConfigurator/>
├── components/
│   ├── AddressSearch.tsx        # debounced Autocomplete
│   ├── MapView.tsx              # Mapbox GL + Drawn-Source-Sync
│   ├── PVConfigurator.tsx       # Orchestrator + State
│   └── Sidebar.tsx
├── lib/
│   ├── geo.ts                   # building→Feature, closest building, edge bearing
│   ├── overpass.ts              # Overpass-Mirror-Cascade mit Timeout
│   └── panel-grid.ts            # Modul-Fitting + Yield-Heuristik
├── types/
│   └── index.ts                 # gemeinsame TS-Typen
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.local.example
```

## Setup

### 1. Mapbox-Token besorgen

1. Auf [https://account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/) anmelden (kostenlos, 50k Loads / Monat im Free Tier).
2. Default-Public-Token kopieren.
3. Vor Produktiv-Einsatz: Token-Restrictions auf eure Domain setzen (z. B. `https://www.ab-solarenergy.de/*`).

### 2. Repo klonen + Deps installieren

```bash
git clone https://github.com/akheyo/youman-automation.git
cd youman-automation/next-app
npm install
```

### 3. Environment-Variablen

```bash
cp .env.local.example .env.local
# .env.local öffnen und NEXT_PUBLIC_MAPBOX_TOKEN setzen
```

| Variable | Pflicht | Zweck |
| --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Ja | Public Token, wird im Browser von Mapbox GL JS verwendet. |
| `MAPBOX_SECRET_TOKEN` | Nein | Secret Token für die Server-seitige Geocoding-Route. Fallback: `NEXT_PUBLIC_MAPBOX_TOKEN`. |
| `OVERPASS_URL` | Nein | Override für den Overpass-Mirror. Leer lassen für Built-in-Cascade. |

### 4. Dev-Server starten

```bash
npm run dev
# → http://localhost:3000
```

### 5. Production-Build

```bash
npm run build
npm run start
```

## Datenfluss

```
[ User tippt Adresse ]
        │ (debounced 250 ms)
        ▼
[ /api/geocode ]  ── Mapbox Geocoding ──► Liste { id, placeName, [lng,lat] }
        │
        ▼ (User wählt einen Treffer)
[ Map flyTo center ]
        │
        ▼
[ /api/buildings ]  ── Overpass Mirror-Cascade ──► [ BuildingFootprint[] ]
        │
        ▼ (turf.booleanPointInPolygon → bestes Polygon)
[ <MapView/> rendert Outline + Fill ]
        │
        ▼ (Turf: rotate longest edge → grid → booleanWithin)
[ Panel-Layout in Sidebar ]
```

## Algorithmus: Modul-Fitting

`lib/panel-grid.ts` macht folgendes:

1. Bestimmt die **Bearing der längsten Kante** des Polygons (`longestEdgeBearing`).
2. Rotiert das Polygon **um den Centroiden** so, dass die längste Kante horizontal ist.
3. Schrumpft das rotierte Polygon um den **Setback (0,5 m)** mit `turf.buffer(-radius)`.
4. Iteriert ein Raster aus 1,7 × 1,1 m Rechtecken durch die Bounding-Box.
5. Behält jedes Rechteck das **vollständig im Inset-Polygon liegt** (`turf.booleanWithin`).
6. Rotiert die akzeptierten Panels **um den gleichen Centroiden zurück** — damit liegen sie geographisch korrekt.

Default-Watt: 400 Wp/Modul. Anpassbar via `fitPanels(polygon, { panelWattPeak: ... })`.

## Bonus: Yield-Estimation

`estimateYearlyKwh(kwp, tilt, azimuth)` nutzt eine vereinfachte Cosinus-Heuristik kalibriert auf Norddeutschland (~1000 kWh/kWp Optimum). Reicht für ein Quote-Sheet; für eine echte Planungsrechnung sollte PVGIS angesprochen werden (`https://re.jrc.ec.europa.eu/api/v5_2/PVcalc`).

## Bonus: Manuelle Polygon-Bearbeitung

Klick auf **„Polygon bearbeiten"** in der Sidebar aktiviert mapbox-gl-draw im `direct_select`-Modus. Jeder Drag/Add eines Punktes ruft `onPolygonEdit(feature)` auf, der State im Orchestrator wird ersetzt und Fläche + Modul-Layout neu berechnet.

## Bonus: PDF-Export

Beim Klick auf **„Als PDF exportieren"** wird die ganze Seite mit `html2canvas` gerendert und als A4-Querformat-Bild via `jsPDF` gespeichert. Lazy-Load via `import()` damit das nicht im Initial-Bundle landet.

## Bekannte Limitierungen

- **OSM-Datenqualität**: Footprints in ländlichen Gebieten können fehlen oder zu großzügig (Haupthaus + Garage als ein Polygon) sein. Workaround: User editiert manuell.
- **Yield-Heuristik**: keine Verschattungs-Analyse, kein Albedo, kein PVGIS-Call.
- **Flach-Projektion**: das Modul-Raster geht von einem flachen Polygon aus. Für Satteldächer gibt der Sidebar-Slider eine Orientierung an, die in den Yield einfließt — die Module werden aber 2D auf den Footprint gelegt.

## Production-Deployment

Vercel ist der Pfad des geringsten Widerstands:

```bash
vercel --prod
```

Beim ersten Deploy bittet Vercel um die Env-Vars — einfach übernehmen.
