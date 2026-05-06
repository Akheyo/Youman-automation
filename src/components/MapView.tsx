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
  // Immer ein Background-Layer als Sicherheitsnetz, damit der Map-Container
  // auch dann eine sichtbare Farbe hat, wenn alle Tile-Requests scheitern
  // (z. B. 403 wegen Domain-Restriction des Tile-Anbieters).
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
    const rect = containerRef.current.getBoundingClientRect();
    // eslint-disable-next-line no-console
    console.log("[MapView] mounting, container size:", rect.width, "x", rect.height);
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

    // Three-Layer immer dann (re-)hinzufügen, wenn der aktuelle Style fertig
    // geladen ist. Deckt sowohl den initialen `load` als auch spätere
    // `setStyle`-Aufrufe ab. MapLibre wirft Style-Custom-Layers beim
    // Style-Wechsel raus, daher idempotent neu erzeugen.
    const ensureThreeLayer = () => {
      if (!mapRef.current) return;
      try {
        if (mapRef.current.getLayer("youman-three-building")) return;
      } catch {
        /* getLayer kann werfen, wenn Style noch nicht ready ist – ignorieren */
      }
      try {
        const layer = new ThreeBuildingLayer({ showEdges: true });
        mapRef.current.addLayer(layer);
        layerRef.current = layer;
        // eslint-disable-next-line no-console
        console.log("[MapView] Three layer added");
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
      } catch (err) {
        // Three-Layer darf die Karte nicht killen.
        console.error("[MapView] Three-Layer konnte nicht hinzugefügt werden:", err);
      }
    };

    map.on("load", () => {
      // eslint-disable-next-line no-console
      console.log("[MapView] map.load fired");
      ensureThreeLayer();
      // Resize triggern – MapLibre rechnet die Canvas-Größe oft erst nach
      // dem ersten Layout-Frame korrekt aus, und ein nicht resized Canvas
      // bleibt 0×0 und damit unsichtbar.
      mapRef.current?.resize();
    });
    map.on("style.load", () => {
      // eslint-disable-next-line no-console
      console.log("[MapView] map.style.load fired");
      ensureThreeLayer();
    });
    map.on("error", (e) => {
      // Tile-Fehler etc. nur loggen, nicht crashen.
      // eslint-disable-next-line no-console
      console.warn("[MapLibre]", e?.error?.message ?? e);
    });

    // Resize-Beobachter: wenn der Container später noch wächst (z. B. weil
    // Sidebar/Layout asynchron auflöst), zwingt das MapLibre die Canvas
    // anzupassen. Behebt den weiß-bleibenden Map-Bereich, wenn der Container
    // beim ersten Mount 0-Höhe hatte.
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

  // 2) StrictMode-fester Schutz: Style wird beim Mount im Constructor gesetzt,
  // ein nachträgliches setStyle() würde nur die Race-Condition mit der ersten
  // Style-Ladung erneut auslösen. Da die `mapSettings` aus env-Variablen
  // kommen und ohne Server-Restart sowieso nicht wechseln, ist hier kein
  // Effect mehr nötig.

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
