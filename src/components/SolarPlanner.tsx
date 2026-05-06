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
  MapSettings,
  ModuleSettings,
  RoofFace,
} from "@/types/solar";
import { placeModulesOnSelectedFaces } from "@/lib/geometry/modulePlacement";
import {
  MockRoofDetectionProvider,
  getAvailableMockKinds,
} from "@/lib/providers/mockRoofDetectionProvider";
import type { MockBuildingKind } from "@/lib/geometry/mockRoofs";
import Sidebar from "./Sidebar";
import MapView from "./MapView";

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
  const [recenterTick, setRecenterTick] = useState(0);

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

  /* -------- Lifecycle: load demo on first mount -------- */

  useEffect(() => {
    void loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleDetect = useCallback(async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/detect-roof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [address, settings, recomputeBuilding]);

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

  const providerLabel = useMemo(() => {
    if (!providerInfo) return null;
    switch (providerInfo.name) {
      case "google-solar":
        return "Google Solar API";
      case "lod2":
        return "LoD2 (amtlich)";
      case "osm":
        return "OpenStreetMap";
      case "mock":
        return "Mock (Demo)";
      default:
        return providerInfo.name;
    }
  }, [providerInfo]);

  return (
    <div className="flex h-full w-full flex-row">
      <div style={{ flex: "1 1 auto", minWidth: 0, height: "100%", position: "relative" }}>
        <MapView
          building={building}
          mapSettings={mapSettings}
          recenterTick={recenterTick}
        />
      </div>
      <Sidebar
        address={address}
        setAddress={setAddress}
        onDetect={handleDetect}
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
      />
    </div>
  );
}
