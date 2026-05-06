"use client";

/**
 * MapView – die große 3D-Karte links.
 *
 * Strukturell bewusst nahe an der funktionierenden /test-map gehalten:
 * inline-styles für die Container-Größe, kein dynamic-Import, kein
 * antialias-Flag, kein ResizeObserver, kein flyTo im load-Handler.
 * Das Gebäude wird ausschließlich über den NativeBuildingLayer als
 * fill-extrusion gerendert.
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
      const layer = new NativeBuildingLayer(mapRef.current);
      layer.install();
      layerRef.current = layer;
      const b = buildingRef.current;
      if (b) layer.setBuilding(b);
    });

    return () => {
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
    <div style={{ position: "relative", height: "100%", width: "100%", background: "#e2e8f0" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {!mapSettings.tileUrl && (
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
