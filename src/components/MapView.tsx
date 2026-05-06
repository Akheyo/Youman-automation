"use client";

/**
 * MapView – die große 3D-Karte links.
 *
 * Strukturell bewusst nahe an der funktionierenden /test-map gehalten:
 * inline-styles für die Container-Größe, kein dynamic-Import, kein
 * antialias-Flag, kein ResizeObserver, kein flyTo im load-Handler.
 *
 * Zusatz-Modus „Drawing": Wenn `drawingMode` true ist, sammelt MapView
 * Map-Klicks als lng/lat-Punkte und gibt sie per `onMapClick` zurück.
 * Eine separate GeoJSON-Source rendert die bereits gezeichneten Punkte
 * + Verbindungslinien als Vorschau.
 */

import { useEffect, useMemo, useRef } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { DetectedBuilding, LngLat, MapSettings } from "@/types/solar";
import { NativeBuildingLayer } from "@/lib/map/NativeBuildingLayer";
import { ThreeBuildingLayer } from "@/lib/map/ThreeBuildingLayer";

type MapViewProps = {
  building: DetectedBuilding | null;
  mapSettings: MapSettings;
  /** Bei jeder Erhöhung wird die Kamera neu auf das Gebäude zentriert. */
  recenterTick: number;
  /** Drawing-Modus: Polygon-Eckpunkte sammeln. */
  drawingMode: boolean;
  /** Picking-Modus: nur 1 Klick → Parent fragt OSM ab. */
  pickingMode: boolean;
  /** Bisher gezeichnete Punkte (nur drawingMode). */
  drawnPoints: LngLat[];
  /** Callback bei jedem Klick (Parent dispatcht je nach Modus). */
  onMapClick: (p: LngLat) => void;
};

const DRAW_SRC = "youman-draw";
const DRAW_LINE_LAYER = "youman-draw-line";
const DRAW_FILL_LAYER = "youman-draw-fill";
const DRAW_POINT_LAYER = "youman-draw-points";

function buildStyle(
  tileUrl: string | undefined,
  attribution: string | undefined,
): StyleSpecification {
  const backgroundLayer = {
    id: "background",
    type: "background" as const,
    paint: { "background-color": "#e2e8f0" },
  };
  if (tileUrl) {
    return {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 256,
          attribution: attribution ?? "",
        },
      },
      layers: [
        backgroundLayer,
        { id: "basemap", type: "raster", source: "basemap" },
      ],
    };
  }
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap-Mitwirkende",
        maxzoom: 19,
      },
    },
    layers: [
      backgroundLayer,
      { id: "osm", type: "raster", source: "osm" },
    ],
  };
}

export default function MapView({
  building,
  mapSettings,
  recenterTick,
  drawingMode,
  pickingMode,
  drawnPoints,
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const layerRef = useRef<NativeBuildingLayer | null>(null);
  const threeRef = useRef<ThreeBuildingLayer | null>(null);
  const buildingRef = useRef<DetectedBuilding | null>(building);
  buildingRef.current = building;
  // Refs, damit der Click-Handler in der Map-Init immer auf aktuelle Werte
  // schaut (keine Re-Init bei jedem State-Update nötig).
  const captureClicksRef = useRef(drawingMode || pickingMode);
  captureClicksRef.current = drawingMode || pickingMode;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const style = useMemo(
    () => buildStyle(mapSettings.tileUrl, mapSettings.tileAttribution),
    [mapSettings.tileUrl, mapSettings.tileAttribution],
  );

  // Karte einmalig erzeugen.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initialCenter: [number, number] = buildingRef.current
      ? [buildingRef.current.center.lng, buildingRef.current.center.lat]
      : [13.405, 52.52];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: initialCenter,
      zoom: 19,
      pitch: 60,
      bearing: -30,
    });
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-left",
    );
    mapRef.current = map;

    map.on("load", () => {
      if (!mapRef.current) return;
      // Building-Layer.
      const layer = new NativeBuildingLayer(mapRef.current);
      layer.install();
      layerRef.current = layer;
      const three = new ThreeBuildingLayer({ showEdges: true });
      mapRef.current.addLayer(three);
      threeRef.current = three;

      // Drawing-Source + Layer (initial leer).
      mapRef.current.addSource(DRAW_SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      mapRef.current.addLayer({
        id: DRAW_FILL_LAYER,
        type: "fill",
        source: DRAW_SRC,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#f97316",
          "fill-opacity": 0.18,
        },
      });
      mapRef.current.addLayer({
        id: DRAW_LINE_LAYER,
        type: "line",
        source: DRAW_SRC,
        filter: ["!=", ["geometry-type"], "Point"],
        paint: {
          "line-color": "#f97316",
          "line-width": 2,
        },
      });
      mapRef.current.addLayer({
        id: DRAW_POINT_LAYER,
        type: "circle",
        source: DRAW_SRC,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#f97316",
          "circle-stroke-width": 2,
        },
      });

      const b = buildingRef.current;
      if (b) {
        layer.setBuilding(b);
        three.setBuilding(b);
      }
    });

    // Click-Handler: nur im Drawing- oder Picking-Modus greifen.
    map.on("click", (e) => {
      if (!captureClicksRef.current) return;
      onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn das Gebäude wechselt: Layer aktualisieren + Kamera schwenken.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    const three = threeRef.current;
    if (!map || !layer || !building) return;
    layer.setBuilding(building);
    three?.setBuilding(building);
    map.flyTo({
      center: [building.center.lng, building.center.lat],
      zoom: 19,
      pitch: 60,
      bearing: -30,
      essential: true,
    });
  }, [building]);

  // Manuelles Recenter aus der Sidebar.
  useEffect(() => {
    if (recenterTick === 0) return;
    const map = mapRef.current;
    const b = buildingRef.current;
    if (!map || !b) return;
    map.flyTo({
      center: [b.center.lng, b.center.lat],
      zoom: 19,
      pitch: 60,
      bearing: -30,
      essential: true,
    });
  }, [recenterTick]);

  // Cursor je nach Drawing-/Picking-Modus.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = drawingMode || pickingMode ? "crosshair" : "";
  }, [drawingMode, pickingMode]);

  // Drawing-Vorschau aktualisieren, wann immer drawnPoints sich ändern.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(DRAW_SRC) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!src) return;

    const features: GeoJSON.Feature[] = [];
    if (drawnPoints.length === 0) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    // Punkte als Circle-Markers.
    for (let i = 0; i < drawnPoints.length; i++) {
      const p = drawnPoints[i]!;
      features.push({
        type: "Feature",
        properties: { idx: i },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      });
    }
    // Linie/Polygon: ab 2 Punkten LineString, ab 3 Punkten zusätzlich Polygon
    // (Polygon-Vorschau füllt das Gebäude bereits orange ein, sobald es eine
    // sinnvolle Form hat).
    if (drawnPoints.length >= 2) {
      features.push({
        type: "Feature",
        properties: { kind: "line" },
        geometry: {
          type: "LineString",
          coordinates: drawnPoints.map((p) => [p.lng, p.lat]),
        },
      });
    }
    if (drawnPoints.length >= 3) {
      const ring = drawnPoints.map((p) => [p.lng, p.lat]);
      ring.push([drawnPoints[0]!.lng, drawnPoints[0]!.lat]);
      features.push({
        type: "Feature",
        properties: { kind: "polygon" },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }, [drawnPoints]);

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        background: "#e2e8f0",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {pickingMode && (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            maxWidth: 420,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.95)",
            color: "#0f172a",
            fontSize: 13,
            lineHeight: 1.45,
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(15,23,42,0.18)",
          }}
        >
          <strong style={{ fontWeight: 600 }}>Haus auswählen:</strong> Einmal auf
          das gewünschte Haus klicken. App holt den echten Footprint aus
          OpenStreetMap und nimmt deine Slider-Werte fürs Dach.
        </div>
      )}
      {drawingMode && (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            maxWidth: 420,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.95)",
            color: "#0f172a",
            fontSize: 13,
            lineHeight: 1.45,
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(15,23,42,0.18)",
          }}
        >
          <strong style={{ fontWeight: 600 }}>Zeichnen:</strong> Klicke nacheinander
          die Eckpunkte des Hauses an. Mindestens 3 Punkte. In der Sidebar dann
          &bdquo;Fertig&ldquo; drücken.
        </div>
      )}
      {!mapSettings.tileUrl && !drawingMode && !pickingMode && (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            maxWidth: 380,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.85)",
            color: "#334155",
            fontSize: 12,
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            backdropFilter: "blur(4px)",
          }}
        >
          <strong style={{ fontWeight: 600, color: "#0f172a" }}>Hinweis:</strong>{" "}
          Für Satellitenbilder bitte <code>NEXT_PUBLIC_TILE_URL</code> setzen.
          Aktuell wird eine helle OSM-Karte als Fallback genutzt.
        </div>
      )}
    </div>
  );
}
