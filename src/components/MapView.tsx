"use client";

/**
 * MapView – die große 3D-Karte links.
 *
 * MapLibre GL JS dient als Basemap UND als Renderer für das Gebäude.
 * Die `NativeBuildingLayer` zeichnet Wände, Dachflächen und PV-Module
 * über native `fill-extrusion`-Layer; kein Three.js, keine Konflikte
 * im geteilten WebGL-Kontext.
 */

import { useEffect, useMemo, useRef } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { DetectedBuilding, MapSettings } from "@/types/solar";
import { NativeBuildingLayer } from "@/lib/map/NativeBuildingLayer";

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
  // Immer ein Background-Layer als Sicherheitsnetz, damit der Map-Container
  // auch dann eine sichtbare Farbe hat, wenn alle Tile-Requests scheitern.
  const backgroundLayer = {
    id: "background",
    type: "background" as const,
    paint: { "background-color": "#e2e8f0" },
  };

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
        backgroundLayer,
        { id: "basemap", type: "raster", source: "basemap" },
      ],
    };
  }
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: { "raster-opacity": 0.9 },
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
  const layerRef = useRef<NativeBuildingLayer | null>(null);
  const buildingRef = useRef<DetectedBuilding | null>(building);
  buildingRef.current = building;

  const style = useMemo(
    () => buildStyle(mapSettings.tileUrl, mapSettings.tileAttribution),
    [mapSettings.tileUrl, mapSettings.tileAttribution],
  );

  // Karte einmalig erzeugen.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // eslint-disable-next-line no-console
    console.log(
      "[MapView] mounting, container size:",
      rect.width,
      "x",
      rect.height,
    );
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
    // eslint-disable-next-line no-console
    console.log("[MapView] MapLibre map created");

    // Native fill-extrusion-Layer installieren, sobald der Style bereit ist.
    const ensureBuildingLayer = () => {
      if (!mapRef.current) return;
      try {
        const layer =
          layerRef.current ?? new NativeBuildingLayer(mapRef.current);
        layer.install();
        layerRef.current = layer;
        const b = buildingRef.current;
        if (b) {
          layer.setBuilding(b);
          mapRef.current.flyTo({
            center: [b.center.lng, b.center.lat],
            zoom: 19,
            pitch: 60,
            bearing: -30,
            essential: true,
          });
        }
        // eslint-disable-next-line no-console
        console.log("[MapView] native building layer ready");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[MapView] Layer-Installation fehlgeschlagen:", err);
      }
    };

    map.on("load", () => {
      // eslint-disable-next-line no-console
      console.log("[MapView] map.load fired");
      ensureBuildingLayer();
      mapRef.current?.resize();
    });
    map.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.warn("[MapLibre]", e?.error?.message ?? e);
    });

    // Resize-Beobachter, falls der Container nach dem Mount noch wächst.
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn das Gebäude wechselt: Layer aktualisieren + Kamera schwenken.
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

  return (
    <div className="relative h-full w-full bg-slate-200">
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
