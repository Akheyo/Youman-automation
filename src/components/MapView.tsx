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

import type {
  DetectedBuilding,
  LngLat,
  MapSettings,
  ModuleSlot,
} from "@/types/solar";
import { NativeBuildingLayer } from "@/lib/map/NativeBuildingLayer";
import { ThreeBuildingLayer } from "@/lib/map/ThreeBuildingLayer";
import { findFaceUnderClick } from "@/lib/geometry/manualModulePlacement";
import { localMetersToLngLat } from "@/lib/geometry/coordinates";

type MapViewProps = {
  building: DetectedBuilding | null;
  mapSettings: MapSettings;
  /** Vordefinierte Modul-Slots auf allen ausgewählten Dachflächen. */
  slots: ModuleSlot[];
  /** Welche Slots aktuell mit einem Modul belegt sind. */
  occupiedSlotIds: Set<string>;
  /** Klick auf einen Slot: platziert oder entfernt das Modul dort. */
  onToggleSlot: (slotId: string) => void;
  /** Klick auf eine Dachfläche außerhalb der Slots: Detail-Modal. */
  onOpenFaceModal: (faceId: string) => void;
  /** Bei jeder Erhöhung wird die Kamera neu auf das Gebäude zentriert. */
  recenterTick: number;
  /** Drawing-Modus: Polygon-Eckpunkte / First-Linie sammeln. */
  drawingMode: boolean;
  /** Drawing-Sub-Phase: erst Ecken, dann optional First. */
  drawingPhase: "corners" | "ridge";
  /** Picking-Modus: nur 1 Klick → Parent fragt OSM ab. */
  pickingMode: boolean;
  /** Bisher gezeichnete Eckpunkte. */
  drawnPoints: LngLat[];
  /** First-Linien-Punkte (max 2). */
  ridgePoints: LngLat[];
  /** Callback bei jedem Klick im Drawing/Picking-Modus. */
  onMapClick: (p: LngLat) => void;
  /** Kamera fliegt hierhin, wenn cameraTick sich erhöht (z. B. nach Suche). */
  cameraTarget: LngLat | null;
  cameraTick: number;
  /** Drag-to-rotate aktiv: Map-Pan/Rotate ist disabled, Maus dreht das Haus. */
  rotatingMode: boolean;
  /** Aktuelle Hausausrichtung in Grad – Startwert für Drag-Berechnung. */
  currentRidgeAzimuthDeg: number | null;
  /** Callback wenn der User per Maus auf eine neue Ausrichtung gedreht hat. */
  onRotateRequest: (newAzimuthDeg: number) => void;
};

const DRAW_SRC = "youman-draw";
const DRAW_LINE_LAYER = "youman-draw-line";
const DRAW_FILL_LAYER = "youman-draw-fill";
const DRAW_POINT_LAYER = "youman-draw-points";

const SLOT_SRC = "youman-slots";
const SLOT_FILL_LAYER = "youman-slot-fill";
const SLOT_LINE_LAYER = "youman-slot-line";

function emptySlotData(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

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
  slots,
  occupiedSlotIds,
  onToggleSlot,
  onOpenFaceModal,
  recenterTick,
  drawingMode,
  drawingPhase,
  pickingMode,
  drawnPoints,
  ridgePoints,
  onMapClick,
  cameraTarget,
  cameraTick,
  rotatingMode,
  currentRidgeAzimuthDeg,
  onRotateRequest,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const layerRef = useRef<NativeBuildingLayer | null>(null);
  const threeRef = useRef<ThreeBuildingLayer | null>(null);
  const buildingRef = useRef<DetectedBuilding | null>(building);
  buildingRef.current = building;
  // Refs, damit der Click-Handler in der Map-Init immer auf aktuelle Werte
  // schaut (keine Re-Init bei jedem State-Update nötig).
  const captureModeRef = useRef(drawingMode || pickingMode);
  captureModeRef.current = drawingMode || pickingMode;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onToggleSlotRef = useRef(onToggleSlot);
  onToggleSlotRef.current = onToggleSlot;
  const onOpenFaceModalRef = useRef(onOpenFaceModal);
  onOpenFaceModalRef.current = onOpenFaceModal;
  const ridgeAzRef = useRef<number | null>(currentRidgeAzimuthDeg);
  ridgeAzRef.current = currentRidgeAzimuthDeg;
  const onRotateRequestRef = useRef(onRotateRequest);
  onRotateRequestRef.current = onRotateRequest;

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
          "fill-color": "#1e50e0",
          "fill-opacity": 0.18,
        },
      });
      // Eckpunkt-Linien (orange).
      mapRef.current.addLayer({
        id: DRAW_LINE_LAYER,
        type: "line",
        source: DRAW_SRC,
        filter: [
          "all",
          ["!=", ["geometry-type"], "Point"],
          ["!=", ["get", "kind"], "ridgeLine"],
        ],
        paint: {
          "line-color": "#1e50e0",
          "line-width": 2,
        },
      });
      // First-Linie (blau, dicker).
      mapRef.current.addLayer({
        id: DRAW_LINE_LAYER + "-ridge",
        type: "line",
        source: DRAW_SRC,
        filter: ["==", ["get", "kind"], "ridgeLine"],
        paint: {
          "line-color": "#1e50e0",
          "line-width": 4,
        },
      });
      // Eckpunkt-Kreise (orange).
      mapRef.current.addLayer({
        id: DRAW_POINT_LAYER,
        type: "circle",
        source: DRAW_SRC,
        filter: [
          "all",
          ["==", ["geometry-type"], "Point"],
          ["==", ["get", "kind"], "corner"],
        ],
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#1e50e0",
          "circle-stroke-width": 2,
        },
      });
      // First-Endpunkte (blau, größer).
      mapRef.current.addLayer({
        id: DRAW_POINT_LAYER + "-ridge",
        type: "circle",
        source: DRAW_SRC,
        filter: [
          "all",
          ["==", ["geometry-type"], "Point"],
          ["==", ["get", "kind"], "ridge"],
        ],
        paint: {
          "circle-radius": 6,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#1e50e0",
          "circle-stroke-width": 3,
        },
      });

      // Slot-Layer: leerer Slot = helle Fläche, besetzter Slot = transparent
      // (das Three.js-Modul darüber bleibt sichtbar), aber bleibt klickbar
      // für queryRenderedFeatures.
      mapRef.current.addSource(SLOT_SRC, {
        type: "geojson",
        data: emptySlotData(),
      });
      mapRef.current.addLayer({
        id: SLOT_FILL_LAYER,
        type: "fill",
        source: SLOT_SRC,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "occupied"], true],
            "#0f172a",
            "rgb(220,220,220)",
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "occupied"], true],
            0.0,
            0.35,
          ],
        },
      });
      mapRef.current.addLayer({
        id: SLOT_LINE_LAYER,
        type: "line",
        source: SLOT_SRC,
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "occupied"], true],
            "rgba(15,23,42,0)",
            "#ffffff",
          ],
          "line-width": 1,
        },
      });

      const b = buildingRef.current;
      if (b) {
        layer.setBuilding(b);
        three.setBuilding(b);
      }
    });

    // Klick-Dispatch: Drawing/Picking haben Priorität. Sonst Slot oder Face.
    map.on("click", (e) => {
      if (captureModeRef.current) {
        onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        return;
      }
      const map2 = mapRef.current;
      if (!map2) return;
      const slotFeatures = map2.queryRenderedFeatures(e.point, {
        layers: [SLOT_FILL_LAYER],
      });
      if (slotFeatures.length > 0) {
        const slotId = slotFeatures[0]!.properties?.slotId as
          | string
          | undefined;
        if (slotId) {
          onToggleSlotRef.current(slotId);
          return;
        }
      }
      const b2 = buildingRef.current;
      if (!b2) return;
      const click = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      const face = findFaceUnderClick(click, b2);
      if (face) onOpenFaceModalRef.current(face.id);
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

  // Kamera-Flug zur gesuchten Adresse (auch wenn noch kein Building da ist).
  useEffect(() => {
    if (cameraTick === 0 || !cameraTarget) return;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [cameraTarget.lng, cameraTarget.lat],
      zoom: 19,
      pitch: 60,
      bearing: -30,
      essential: true,
    });
  }, [cameraTick, cameraTarget]);

  // Cursor je nach aktivem Modus.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (drawingMode || pickingMode) canvas.style.cursor = "crosshair";
    else if (rotatingMode) canvas.style.cursor = "grab";
    else canvas.style.cursor = "";
  }, [drawingMode, pickingMode, rotatingMode]);

  /* Slots ins Map-Source schreiben. Jeder Slot wird zu einem Polygon mit
   * `slotId` und `occupied`-Property. Leere Slots sind sichtbar
   * (helles Rechteck), besetzte Slots transparent (das Three.js-Modul
   * darüber bleibt sichtbar), aber für queryRenderedFeatures klickbar. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SLOT_SRC) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!src) return;
    if (!building) {
      src.setData(emptySlotData());
      return;
    }
    const features: GeoJSON.Feature[] = slots.map((slot) => {
      const ring = slot.corners.map((v) =>
        localMetersToLngLat(v.x, v.y, building.center.lng, building.center.lat),
      );
      ring.push(ring[0]!);
      return {
        type: "Feature",
        properties: {
          slotId: slot.id,
          faceId: slot.roofFaceId,
          occupied: occupiedSlotIds.has(slot.id),
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring.map((p) => [p.lng, p.lat])],
        },
      };
    });
    src.setData({ type: "FeatureCollection", features });
  }, [slots, occupiedSlotIds, building]);

  /* Drag-to-rotate: Mausziehen dreht das Haus um seinen Mittelpunkt.
   * Während aktiv ist MapLibre's Pan/Rotate disabled. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !rotatingMode) return;
    map.dragPan.disable();
    map.dragRotate.disable();
    const canvas = map.getCanvas();

    let dragging = false;
    let startScreenAngleDeg = 0;
    let startRidgeAz = 0;

    const screenAngle = (e: MouseEvent): number | null => {
      const b = buildingRef.current;
      if (!b || !mapRef.current) return null;
      const c = mapRef.current.project([b.center.lng, b.center.lat]);
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // atan2(y, x) → CW (gedreht) ist positiv, da Bildschirm-Y nach unten zeigt.
      return (Math.atan2(my - c.y, mx - c.x) * 180) / Math.PI;
    };

    const onDown = (e: MouseEvent) => {
      const a = screenAngle(e);
      if (a === null) return;
      e.preventDefault();
      startScreenAngleDeg = a;
      startRidgeAz = ridgeAzRef.current ?? 0;
      dragging = true;
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const a = screenAngle(e);
      if (a === null) return;
      const delta = a - startScreenAngleDeg;
      let newAz = startRidgeAz + delta;
      newAz = ((newAz % 360) + 360) % 360;
      onRotateRequestRef.current(newAz);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    return () => {
      map.dragPan.enable();
      map.dragRotate.enable();
      canvas.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [rotatingMode]);

  // Drawing-Vorschau aktualisieren, wann immer drawnPoints oder ridgePoints
  // sich ändern. Polygon: orange. First: blaue Linie mit blauen Endpunkten.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(DRAW_SRC) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!src) return;

    const features: GeoJSON.Feature[] = [];

    // Eckpunkte als Circle-Markers (orange via "kind"="corner").
    for (let i = 0; i < drawnPoints.length; i++) {
      const p = drawnPoints[i]!;
      features.push({
        type: "Feature",
        properties: { kind: "corner", idx: i },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      });
    }
    if (drawnPoints.length >= 2) {
      features.push({
        type: "Feature",
        properties: { kind: "edges" },
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

    // First-Linie: blau, eigene Linie mit eigenen Endpunkt-Markern.
    for (let i = 0; i < ridgePoints.length; i++) {
      const p = ridgePoints[i]!;
      features.push({
        type: "Feature",
        properties: { kind: "ridge", idx: i },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      });
    }
    if (ridgePoints.length === 2) {
      features.push({
        type: "Feature",
        properties: { kind: "ridgeLine" },
        geometry: {
          type: "LineString",
          coordinates: ridgePoints.map((p) => [p.lng, p.lat]),
        },
      });
    }

    src.setData({ type: "FeatureCollection", features });
  }, [drawnPoints, ridgePoints]);

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
      {rotatingMode && (
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
          <strong style={{ fontWeight: 600 }}>Drehen aktiv:</strong>{" "}
          Halte die linke Maustaste auf der Karte und ziehe, um das Haus zu
          drehen. Mit dem Slider in der Sidebar feinjustieren. Erneut auf
          &bdquo;Drehen&ldquo; klicken zum Beenden.
        </div>
      )}
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
          {drawingPhase === "corners" ? (
            <>
              <strong style={{ fontWeight: 600 }}>Schritt 1 &mdash; Eckpunkte:</strong>{" "}
              Klicke die Hausecken an (mindestens 3). In der Sidebar dann
              &bdquo;Weiter zur First&ldquo; oder &bdquo;Fertig&ldquo;.
            </>
          ) : (
            <>
              <strong style={{ fontWeight: 600, color: "#1e50e0" }}>
                Schritt 2 &mdash; First-Linie:
              </strong>{" "}
              Klicke 2 Punkte für die First-Linie (Dachrücken). Dann in der
              Sidebar &bdquo;Fertig&ldquo;.
            </>
          )}
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
