"use client";

/**
 * SolarPlanner – State-Container und Orchestrator.
 *
 * Verbindet:
 *   - MapView (3D-Visualisierung)
 *   - Sidebar (UI für Adresse, Dachflächen-Auswahl, Settings, Kennzahlen)
 *
 * Datenfluss:
 *   1. Adresse → /api/detect-roof → DetectedBuilding
 *   2. RoofFace-Auswahl & ModuleSettings → placeModulesOnSelectedFaces
 *   3. Aktualisierte Module + Metrics → DetectedBuilding (im State)
 *   4. State → MapView rendert per ThreeBuildingLayer
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  DetectedBuilding,
  LngLat,
  MapSettings,
  ModuleSettings,
  RoofFace,
} from "@/types/solar";
import { placeModulesOnSelectedFaces } from "@/lib/geometry/modulePlacement";
import { fitOrientedBox } from "@/lib/geometry/roofShapeHeuristic";
import {
  MockRoofDetectionProvider,
  getAvailableMockKinds,
} from "@/lib/providers/mockRoofDetectionProvider";
import type { MockBuildingKind } from "@/lib/geometry/mockRoofs";
import type { RoofShape } from "@/lib/geometry/roofShapeHeuristic";
import { buildBuildingFromManualFootprint } from "@/lib/manual/buildFromFootprint";
import Sidebar from "./Sidebar";
import MapView from "./MapView";

export type ManualParams = {
  shape: RoofShape;
  pitchDeg: number;
  eaveHeightM: number;
  /** Optional explizit gesetztes First-Azimuth (0–179°). Wenn null, fällt
   *  der Builder auf die OBB-Heuristik zurück. */
  ridgeAzimuthDeg: number | null;
};

const DEFAULT_MANUAL_PARAMS: ManualParams = {
  shape: "satteldach",
  pitchDeg: 35,
  eaveHeightM: 5.5,
  ridgeAzimuthDeg: null,
};

/** OBB-Azimuth aus einem Footprint (zur Initialisierung des Sliders). */
function obbAzimuthFromFootprint(footprint: LngLat[]): number {
  try {
    return fitOrientedBox(footprint).ridgeAzimuthDeg;
  } catch {
    return 0;
  }
}

/**
 * Berechnet das First-Azimuth (CW von Nord, in Grad) aus zwei lng/lat-Punkten.
 * 0° = Nord, 90° = Ost, 180° = Süd, 270° = West. Das Ergebnis liegt in
 * [0°, 180°), weil eine First-Linie keine Richtung hat (a→b ist gleich b→a).
 */
function ridgeAzimuthFromPoints(a: LngLat, b: LngLat): number {
  const meanLat = (a.lat + b.lat) / 2;
  const dx = (b.lng - a.lng) * Math.cos((meanLat * Math.PI) / 180);
  const dy = b.lat - a.lat;
  // atan2(dx, dy) → 0 = nach Norden zeigend, im Uhrzeigersinn.
  let az = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (az < 0) az += 360;
  if (az >= 180) az -= 180;
  return az;
}

const DEFAULT_SETTINGS: ModuleSettings = {
  moduleWp: 430,
  moduleWidthM: 1.13,
  moduleLengthM: 1.72,
  edgeMarginM: 0.3,
  moduleGapM: 0.02,
  orientation: "portrait",
};

const DEFAULT_DEMO_LAT = 52.5163;
const DEFAULT_DEMO_LNG = 13.3777;

type Props = {
  mapSettings: MapSettings;
};

type ProviderInfo = { name: string; reason: string } | null;

export default function SolarPlanner({ mapSettings }: Props) {
  const [address, setAddress] = useState<string>("Marienplatz, München");
  const [building, setBuilding] = useState<DetectedBuilding | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo>(null);
  const [settings, setSettings] = useState<ModuleSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCycleIdx, setDemoCycleIdx] = useState(0);
  // Präsentationsmodus: nach erfolgreicher Hausgenerierung wird die Sidebar
  // ausgeblendet und das 3D-Modell füllt den ganzen Screen. Ein Overlay-
  // Button bringt den User zurück in die Bearbeitung.
  const [presentationMode, setPresentationMode] = useState(false);
  const [recenterTick, setRecenterTick] = useState(0);
  const [drawingMode, setDrawingMode] = useState(false);
  const [pickingMode, setPickingMode] = useState(false);
  const [rotatingMode, setRotatingMode] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<LngLat[]>([]);
  // Drawing-Phase: erst Ecken, dann optional 2 Punkte für die First-Linie.
  const [drawingPhase, setDrawingPhase] = useState<"corners" | "ridge">(
    "corners",
  );
  const [ridgePoints, setRidgePoints] = useState<LngLat[]>([]);
  const [manualParams, setManualParams] = useState<ManualParams>(
    DEFAULT_MANUAL_PARAMS,
  );
  // Adresssuche unabhängig von der Detektion: zuerst nur Geocoding +
  // Kamera-Flug, danach kann der User die Modellierungs-Methode wählen.
  const [searchedLocation, setSearchedLocation] = useState<LngLat | null>(
    null,
  );
  const [cameraTick, setCameraTick] = useState(0);

  /* -------- Helpers -------- */

  const recomputeBuilding = useCallback(
    (b: DetectedBuilding, faces: RoofFace[], s: ModuleSettings) => {
      const modules = placeModulesOnSelectedFaces(faces, s);
      const totalRoofAreaM2 = faces.reduce((acc, f) => acc + f.areaM2, 0);
      const selectedRoofAreaM2 = faces
        .filter((f) => f.selected)
        .reduce((acc, f) => acc + f.areaM2, 0);
      const totalKwp = modules.reduce((acc, m) => acc + m.wp, 0) / 1000;
      const next: DetectedBuilding = {
        ...b,
        roofFaces: faces,
        modules,
        metrics: {
          totalRoofAreaM2,
          selectedRoofAreaM2,
          moduleCount: modules.length,
          totalKwp,
        },
      };
      return next;
    },
    [],
  );

  /* -------- Recompute modules when settings or selection change -------- */

  useEffect(() => {
    if (!building) return;
    setBuilding((prev) => {
      if (!prev) return prev;
      return recomputeBuilding(prev, prev.roofFaces, settings);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  /* -------- Actions -------- */

  /**
   * Schritt 1: Haus per Adresse SUCHEN (Geocoding + Kamera-Flug).
   * Lädt KEIN 3D-Modell. Damit der User danach selbst entscheidet, wie das
   * Dach aufgebaut werden soll (Auto-Erkennung / Klick / Selber zeichnen).
   */
  const handleSearchAddress = useCallback(async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = (await res.json()) as
        | { lat: number; lng: number; formattedAddress: string }
        | { error: string };
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const loc: LngLat = { lng: data.lng, lat: data.lat };
      setSearchedLocation(loc);
      setCameraTick((t) => t + 1);
      // Bestehendes Modell verwerfen, damit der User klar sieht: jetzt erst
      // Dach festlegen. Gleichzeitig Drawing-States resetten.
      setBuilding(null);
      setProviderInfo(null);
      setDrawingMode(false);
      setPickingMode(false);
      setDrawnPoints([]);
      setRidgePoints([]);
      setDrawingPhase("corners");
      setPresentationMode(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Adresse konnte nicht gefunden werden",
      );
    } finally {
      setLoading(false);
    }
  }, [address]);

  /**
   * Schritt 2 – Variante A: Auto-Erkennung über die Provider-Kette
   * (Google Solar → OSM). Funktioniert auch ohne vorherige Adresse,
   * sofern eine im Eingabefeld steht.
   */
  const handleAutoDetect = useCallback(async () => {
    if (!address.trim() && !searchedLocation) {
      setError("Bitte zuerst eine Adresse eingeben oder Haus suchen.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/detect-roof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          searchedLocation
            ? { lat: searchedLocation.lat, lng: searchedLocation.lng, address }
            : { address },
        ),
      });
      const data = (await res.json()) as
        | {
            building: DetectedBuilding;
            providerSelection: { name: string; reason: string };
          }
        | { error: string };
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const computed = recomputeBuilding(
        data.building,
        data.building.roofFaces,
        settings,
      );
      setBuilding(computed);
      setProviderInfo(data.providerSelection);
      setPresentationMode(true);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(
        `Keine Solar- oder Gebäudedaten gefunden. ` +
          `Probier 'Haus auswählen' oder 'Selber zeichnen'. (${raw})`,
      );
    } finally {
      setLoading(false);
    }
  }, [address, searchedLocation, settings, recomputeBuilding]);

  const loadDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const kinds = getAvailableMockKinds();
      const kind: MockBuildingKind = kinds[demoCycleIdx % kinds.length]!;
      const provider = new MockRoofDetectionProvider(kind);
      const built = await provider.detectRoof({
        lat: DEFAULT_DEMO_LAT,
        lng: DEFAULT_DEMO_LNG,
        address: `Demo-Gebäude (${kind})`,
      });
      const computed = recomputeBuilding(built, built.roofFaces, settings);
      setBuilding(computed);
      setProviderInfo({
        name: "mock",
        reason: `Demo: ${kind}. Keine API-Calls.`,
      });
      setPresentationMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo-Ladung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [demoCycleIdx, recomputeBuilding, settings]);

  const cycleDemo = useCallback(() => {
    setDemoCycleIdx((i) => i + 1);
  }, []);

  // Reagiere auf demoCycleIdx-Änderung und lade neue Demo.
  useEffect(() => {
    if (demoCycleIdx === 0) return;
    void loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoCycleIdx]);

  const toggleFace = useCallback(
    (id: string) => {
      setBuilding((prev) => {
        if (!prev) return prev;
        const nextFaces = prev.roofFaces.map((f) =>
          f.id === id ? { ...f, selected: !f.selected } : f,
        );
        return recomputeBuilding(prev, nextFaces, settings);
      });
    },
    [recomputeBuilding, settings],
  );

  const replaceModules = useCallback(() => {
    setBuilding((prev) => {
      if (!prev) return prev;
      return recomputeBuilding(prev, prev.roofFaces, settings);
    });
  }, [recomputeBuilding, settings]);

  const recenter = useCallback(() => {
    setRecenterTick((t) => t + 1);
  }, []);

  /* -------- Drag-to-rotate -------- */

  const toggleRotatingMode = useCallback(() => {
    setRotatingMode((m) => !m);
    setPickingMode(false);
    setDrawingMode(false);
  }, []);

  /** Wird vom MapView aufgerufen, wenn der User per Maus dreht. */
  const handleRotateRequest = useCallback((newAzimuthDeg: number) => {
    setManualParams((prev) => ({
      ...prev,
      ridgeAzimuthDeg: newAzimuthDeg,
    }));
  }, []);

  /* -------- Manual: Picking (1 Klick → OSM Footprint) -------- */

  const startPicking = useCallback(() => {
    setError(null);
    setDrawnPoints([]);
    setDrawingMode(false);
    setPickingMode(true);
  }, []);

  const cancelPicking = useCallback(() => {
    setPickingMode(false);
  }, []);

  const pickHouseAt = useCallback(
    async (p: LngLat) => {
      setPickingMode(false);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/detect-roof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: p.lat,
            lng: p.lng,
            provider: "osm",
          }),
        });
        const data = (await res.json()) as
          | {
              building: DetectedBuilding;
              providerSelection: { name: string; reason: string };
            }
          | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error(
            "error" in data ? data.error : `HTTP ${res.status}`,
          );
        }
        if (data.building.source !== "osm" || !data.building.footprint) {
          throw new Error("osm-not-found");
        }
        // OSM hat den Footprint geliefert – das Dach bauen wir mit den
        // aktuellen manuellen Parametern (Form, Pitch, Traufe), damit der
        // User die Slider sofort als Steuerung benutzen kann.
        const built = buildBuildingFromManualFootprint({
          footprint: data.building.footprint.vertices,
          shape: manualParams.shape,
          pitchDeg: manualParams.pitchDeg,
          eaveHeightM: manualParams.eaveHeightM,
          ridgeAzimuthDeg: manualParams.ridgeAzimuthDeg ?? undefined,
          label: data.building.address ?? "Per Klick gewählt",
        });
        const computed = recomputeBuilding(built, built.roofFaces, settings);
        setBuilding(computed);
        // Slider-Wert auf die jetzt verwendete First-Richtung setzen, damit
        // der User danach unmittelbar an dieser Achse drehen kann.
        const usedAz = obbAzimuthFromFootprint(
          data.building.footprint.vertices,
        );
        setManualParams((prev) => ({
          ...prev,
          ridgeAzimuthDeg:
            prev.ridgeAzimuthDeg ?? usedAz,
        }));
        setProviderInfo({
          name: "manual",
          reason: `Footprint per Klick aus OSM (${data.building.roofFaces.length} OSM-Tags). Form/Pitch/Traufe via Slider veränderbar.`,
        });
        setPresentationMode(true);
      } catch (err) {
        // Smarter Fallback: OSM hat hier nichts – statt zu meckern, nahtlos
        // ins manuelle Zeichnen wechseln. Der ursprüngliche Klick ist bereits
        // der erste Eckpunkt; User klickt einfach die restlichen Ecken nach.
        const message =
          err instanceof Error ? err.message : "Picking fehlgeschlagen";
        if (message === "osm-not-found") {
          setError(
            "OSM kennt das Gebäude nicht – zeichne die restlichen Ecken einfach weiter.",
          );
          setDrawnPoints([p]);
          setDrawingMode(true);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [manualParams, recomputeBuilding, settings],
  );

  /* -------- Manual: Drawing (Polygon + optional First-Linie zeichnen) -------- */

  const startDrawing = useCallback(() => {
    setError(null);
    setDrawnPoints([]);
    setRidgePoints([]);
    setDrawingPhase("corners");
    setPickingMode(false);
    setDrawingMode(true);
  }, []);

  const cancelDrawing = useCallback(() => {
    setDrawingMode(false);
    setDrawnPoints([]);
    setRidgePoints([]);
    setDrawingPhase("corners");
  }, []);

  /** Wechselt von Eckpunkten in die First-Phase (Ridge-Markierung). */
  const proceedToRidge = useCallback(() => {
    if (drawnPoints.length < 3) {
      setError("Mindestens 3 Eckpunkte zeichnen.");
      return;
    }
    setError(null);
    setDrawingPhase("ridge");
  }, [drawnPoints.length]);

  /** Springt direkt vom Ecken-Schritt aufs fertige Modell ohne explizite First. */
  const skipRidge = useCallback(() => {
    finishDrawingNow(/* ridgeAzimuthDeg */ undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnPoints, manualParams, settings, recomputeBuilding]);

  const finishDrawing = useCallback(() => {
    // Wenn der User in der Ridge-Phase ist und 2 Punkte gesetzt hat,
    // berechnen wir Azimuth aus diesen.
    if (drawingPhase === "ridge" && ridgePoints.length === 2) {
      const a = ridgePoints[0]!;
      const b = ridgePoints[1]!;
      const az = ridgeAzimuthFromPoints(a, b);
      finishDrawingNow(az);
    } else if (drawingPhase === "corners" && drawnPoints.length >= 3) {
      finishDrawingNow(undefined);
    } else {
      setError("Bitte 2 Punkte für die First-Linie setzen.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingPhase, ridgePoints, drawnPoints]);

  /** Gemeinsamer Bau-Pfad. Nutzt optional explizites Ridge-Azimuth. */
  function finishDrawingNow(ridgeAzimuthDeg: number | undefined) {
    try {
      const effectiveAz =
        ridgeAzimuthDeg ?? obbAzimuthFromFootprint(drawnPoints);
      const built = buildBuildingFromManualFootprint({
        footprint: drawnPoints,
        shape: manualParams.shape,
        pitchDeg: manualParams.pitchDeg,
        eaveHeightM: manualParams.eaveHeightM,
        ridgeAzimuthDeg: effectiveAz,
        label: "Manuell gezeichnet",
      });
      const computed = recomputeBuilding(built, built.roofFaces, settings);
      setBuilding(computed);
      // Slider matcht jetzt die tatsächliche Hausrichtung.
      setManualParams((prev) => ({
        ...prev,
        ridgeAzimuthDeg: effectiveAz,
      }));
      setProviderInfo({
        name: "manual",
        reason:
          ridgeAzimuthDeg !== undefined
            ? `User: ${drawnPoints.length} Eckpunkte + First (${effectiveAz.toFixed(0)}°).`
            : `User: ${drawnPoints.length} Eckpunkte (First aus OBB-Heuristik = ${effectiveAz.toFixed(0)}°).`,
      });
      setDrawingMode(false);
      setDrawnPoints([]);
      setRidgePoints([]);
      setDrawingPhase("corners");
      setPresentationMode(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Manuelles Bauen fehlgeschlagen",
      );
    }
  }

  const handleMapClick = useCallback(
    (p: LngLat) => {
      if (pickingMode) {
        void pickHouseAt(p);
      } else if (drawingMode) {
        if (drawingPhase === "corners") {
          setDrawnPoints((prev) => [...prev, p]);
        } else if (drawingPhase === "ridge") {
          // Maximal 2 Ridge-Punkte; weitere ersetzen den letzten.
          setRidgePoints((prev) =>
            prev.length < 2 ? [...prev, p] : [...prev.slice(0, 1), p],
          );
        }
      }
    },
    [pickingMode, drawingMode, drawingPhase, pickHouseAt],
  );

  const undoLastPoint = useCallback(() => {
    if (drawingPhase === "ridge") {
      setRidgePoints((prev) => prev.slice(0, -1));
    } else {
      setDrawnPoints((prev) => prev.slice(0, -1));
    }
  }, [drawingPhase]);

  // Wenn manuelle Parameter (Form/Pitch/Traufe) sich ändern UND wir gerade
  // ein manuell gezeichnetes Gebäude im State haben, neu bauen.
  useEffect(() => {
    if (!building || building.source !== "manual") return;
    if (!building.footprint) return;
    try {
      const built = buildBuildingFromManualFootprint({
        footprint: building.footprint.vertices,
        shape: manualParams.shape,
        pitchDeg: manualParams.pitchDeg,
        eaveHeightM: manualParams.eaveHeightM,
        ridgeAzimuthDeg: manualParams.ridgeAzimuthDeg ?? undefined,
        label: "Manuell gezeichnet",
      });
      // Selektion der Dachflächen aus altem State übernehmen, soweit IDs matchen.
      const selectedIds = new Set(
        building.roofFaces.filter((f) => f.selected).map((f) => f.id),
      );
      const faces = built.roofFaces.map((f) => ({
        ...f,
        selected: selectedIds.size === 0 ? f.selected : selectedIds.has(f.id),
      }));
      setBuilding(recomputeBuilding(built, faces, settings));
    } catch {
      /* Pitch/Form-Update darf bestehenden State nicht killen. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualParams]);

  const providerLabel = useMemo(() => {
    if (!providerInfo) return null;
    switch (providerInfo.name) {
      case "google-solar":
        return "Google Solar API";
      case "lod2":
        return "LoD2 (amtlich)";
      case "osm":
        return "OpenStreetMap";
      case "manual":
        return "Manuell gezeichnet";
      case "mock":
        return "Mock (Demo)";
      default:
        return providerInfo.name;
    }
  }, [providerInfo]);

  return (
    <div className="relative flex h-full w-full flex-row">
      <div style={{ flex: "1 1 auto", minWidth: 0, height: "100%", position: "relative" }}>
        <MapView
          building={building}
          mapSettings={mapSettings}
          recenterTick={recenterTick}
          drawingMode={drawingMode}
          drawingPhase={drawingPhase}
          pickingMode={pickingMode}
          drawnPoints={drawnPoints}
          ridgePoints={ridgePoints}
          onMapClick={handleMapClick}
          cameraTarget={searchedLocation}
          cameraTick={cameraTick}
          rotatingMode={rotatingMode}
          currentRidgeAzimuthDeg={manualParams.ridgeAzimuthDeg}
          onRotateRequest={handleRotateRequest}
        />
      </div>
      {!presentationMode && (
        <Sidebar
          address={address}
          setAddress={setAddress}
          onSearchAddress={handleSearchAddress}
          onAutoDetect={handleAutoDetect}
          onLoadDemo={() => void loadDemo()}
          onCycleDemo={cycleDemo}
          onRecenter={recenter}
          onReplaceModules={replaceModules}
          loading={loading}
          error={error}
          building={building}
          providerLabel={providerLabel}
          providerReason={providerInfo?.reason ?? null}
          settings={settings}
          setSettings={setSettings}
          toggleFace={toggleFace}
          searchedLocation={searchedLocation}
          drawingMode={drawingMode}
          drawingPhase={drawingPhase}
          pickingMode={pickingMode}
          rotatingMode={rotatingMode}
          canRotate={Boolean(building?.source === "manual" && building.footprint)}
          onToggleRotating={toggleRotatingMode}
          drawnPointCount={drawnPoints.length}
          ridgePointCount={ridgePoints.length}
          manualParams={manualParams}
          setManualParams={setManualParams}
          onStartPicking={startPicking}
          onCancelPicking={cancelPicking}
          onStartDrawing={startDrawing}
          onCancelDrawing={cancelDrawing}
          onProceedToRidge={proceedToRidge}
          onSkipRidge={skipRidge}
          onFinishDrawing={finishDrawing}
          onUndoPoint={undoLastPoint}
        />
      )}

      {presentationMode && (
        <PresentationOverlay
          building={building}
          providerLabel={providerLabel}
          onExit={() => setPresentationMode(false)}
          onRecenter={recenter}
        />
      )}
    </div>
  );
}

/* ----------------------------- PresentationOverlay ----------------------------- */

type PresentationOverlayProps = {
  building: DetectedBuilding | null;
  providerLabel: string | null;
  onExit: () => void;
  onRecenter: () => void;
};

function PresentationOverlay({
  building,
  providerLabel,
  onExit,
  onRecenter,
}: PresentationOverlayProps) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "12px 16px",
          background: "rgba(255,255,255,0.96)",
          borderRadius: 12,
          boxShadow: "0 6px 20px rgba(15,23,42,0.18)",
          fontSize: 13,
          color: "#0f172a",
          maxWidth: 360,
          zIndex: 20,
        }}
      >
        <p
          style={{
            margin: 0,
            textTransform: "uppercase",
            fontSize: 10,
            letterSpacing: 1,
            color: "#1d4ed8",
            fontWeight: 600,
          }}
        >
          3D-Vorschau
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontWeight: 600,
            fontSize: 16,
            color: "#0f172a",
          }}
        >
          {building?.address ?? "Gebäude"}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
          Quelle: {providerLabel ?? "—"} ·{" "}
          {building?.metrics.totalRoofAreaM2.toFixed(0) ?? "0"} m² Dach ·{" "}
          {building?.metrics.totalKwp.toFixed(1) ?? "0"} kWp
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          gap: 8,
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={onRecenter}
          style={{
            padding: "10px 14px",
            background: "rgba(255,255,255,0.96)",
            color: "#1e3a8a",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(15,23,42,0.10)",
          }}
        >
          Ansicht zentrieren
        </button>
        <button
          type="button"
          onClick={onExit}
          style={{
            padding: "10px 16px",
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(37,99,235,0.30)",
          }}
        >
          ← Zurück zur Bearbeitung
        </button>
      </div>
    </>
  );
}
