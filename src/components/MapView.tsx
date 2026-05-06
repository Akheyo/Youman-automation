"use client";

/**
 * MapView – die große 3D-Karte links.
 *
 * MapLibre GL JS dient als Basemap und als Träger für unseren
 * `ThreeBuildingLayer`. Pitch/Bearing/Zoom kommen aus MapLibre, die
 * Three.js-Geometrie bleibt automatisch georeferenziert.
 */

import { useEffect, useMemo, useRef } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { DetectedBuilding, MapSettings } from "@/types/solar";
import { ThreeBuildingLayer } from "@/lib/map/ThreeBuildingLayer";

type MapViewProps = {
  building: DetectedBuilding | null;
  mapSettings: MapSettings;
  /** Bei jeder Erhöhung wird die Kamera neu auf das Gebäude zentriert. */
  recenterTick: number;
};

function buildStyle(
  tileUrl: string | undefined,
  attribution: string | undefined,
): StyleSpecification {
  if (tileUrl) {
    return {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        basemap: {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 256,
          attribution: attribution ?? "",
        },
      },
      layers: [
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
        },
      ],
    };
  }
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap-Mitwirkende",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#f4f6f8" },
      },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: { "raster-opacity": 0.85 },
      },
    ],
  };
}

export default function MapView({
  building,
  mapSettings,
  recenterTick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const layerRef = useRef<ThreeBuildingLayer | null>(null);
  const buildingRef = useRef<DetectedBuilding | null>(building);
  buildingRef.current = building;

  const style = useMemo(
    () => buildStyle(mapSettings.tileUrl, mapSettings.tileAttribution),
    [mapSettings.tileUrl, mapSettings.tileAttribution],
  );

  // 1) Karte einmalig erzeugen.
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
      antialias: true,
    });
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-left",
    );
    mapRef.current = map;

    map.on("load", () => {
      const layer = new ThreeBuildingLayer({ showEdges: true });
      map.addLayer(layer);
      layerRef.current = layer;
      const b = buildingRef.current;
      if (b) {
        layer.setBuilding(b);
        map.flyTo({
          center: [b.center.lng, b.center.lat],
          zoom: 19,
          pitch: 60,
          bearing: -30,
          essential: true,
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Style ändern (z. B. Tile-URL umkonfiguriert).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(style);
    map.once("style.load", () => {
      const layer = new ThreeBuildingLayer({ showEdges: true });
      map.addLayer(layer);
      layerRef.current = layer;
      const b = buildingRef.current;
      if (b) layer.setBuilding(b);
    });
  }, [style]);

  // 3) Wenn das Gebäude wechselt, Layer aktualisieren + Kamera schwenken.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !building) return;
    layer.setBuilding(building);
    map.flyTo({
      center: [building.center.lng, building.center.lat],
      zoom: 19,
      pitch: 60,
      bearing: -30,
      essential: true,
    });
  }, [building]);

  // 4) Manuelles Recenter aus Sidebar.
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

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!mapSettings.tileUrl && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-md rounded-md bg-white/85 px-3 py-2 text-xs text-slate-700 shadow-card backdrop-blur">
          <strong className="font-semibold text-slate-900">Hinweis:</strong>{" "}
          Für Satellitenbilder bitte <code>NEXT_PUBLIC_TILE_URL</code> setzen.
          Aktuell wird eine helle OSM-Karte als Fallback genutzt.
        </div>
      )}
    </div>
  );
}
