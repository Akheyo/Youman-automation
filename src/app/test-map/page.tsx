"use client";

/**
 * Diagnose-Seite: bare MapLibre ohne SolarPlanner/Sidebar/Layer.
 * Wenn diese Seite rendert, liegt der Bug im SolarPlanner-Layout.
 * Wenn auch hier nichts kommt, ist die Build-/Tile-Konfiguration kaputt.
 */

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function TestMapPage() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const tileUrl = process.env.NEXT_PUBLIC_TILE_URL;
    const map = new maplibregl.Map({
      container: ref.current,
      style: tileUrl
        ? {
            version: 8,
            sources: {
              basemap: { type: "raster", tiles: [tileUrl], tileSize: 256 },
            },
            layers: [
              {
                id: "bg",
                type: "background",
                paint: { "background-color": "#ff00ff" },
              },
              { id: "basemap", type: "raster", source: "basemap" },
            ],
          }
        : {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
              },
            },
            layers: [
              {
                id: "bg",
                type: "background",
                paint: { "background-color": "#ff00ff" },
              },
              { id: "osm", type: "raster", source: "osm" },
            ],
          },
      center: [13.405, 52.52],
      zoom: 17,
      pitch: 0,
      bearing: 0,
    });
    return () => map.remove();
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#00ff00" }}>
      <div
        ref={ref}
        style={{ position: "absolute", inset: 0, background: "#0000ff" }}
      />
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          padding: "8px 12px",
          background: "white",
          fontFamily: "monospace",
          fontSize: 12,
          borderRadius: 4,
          zIndex: 1000,
        }}
      >
        Test-Map · TILE_URL gesetzt: {String(!!process.env.NEXT_PUBLIC_TILE_URL)}
      </div>
    </div>
  );
}
