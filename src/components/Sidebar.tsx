"use client";

/**
 * Sidebar – rechte Spalte des Solarplaners.
 *
 * Bündelt Adresseingabe, Datenquellen-Anzeige, Dachflächen-Liste,
 * Modul-Einstellungen, Kennzahlen und Debug-Panel zu einer scrollbaren
 * Spalte.
 */

import { type FormEvent } from "react";
import type {
  DetectedBuilding,
  ModuleSettings,
  RoofFace,
} from "@/types/solar";
import type { RoofShape } from "@/lib/geometry/roofShapeHeuristic";
import type { ManualParams } from "./SolarPlanner";

import RoofFaceList from "./RoofFaceList";
import ModuleSettingsPanel from "./ModuleSettingsPanel";
import MetricsPanel from "./MetricsPanel";
import JsonDebugPanel from "./JsonDebugPanel";

type Props = {
  address: string;
  setAddress: (a: string) => void;
  onSearchAddress: () => void;
  onAutoDetect: () => void;
  onLoadDemo: () => void;
  onCycleDemo: () => void;
  onRecenter: () => void;
  onClearAllModules: () => void;
  loading: boolean;
  error: string | null;
  building: DetectedBuilding | null;
  providerLabel: string | null;
  providerReason: string | null;
  settings: ModuleSettings;
  setSettings: (s: ModuleSettings) => void;
  toggleFace: (id: string) => void;
  // Workflow-State
  searchedLocation: { lng: number; lat: number } | null;
  drawingMode: boolean;
  drawingPhase: "corners" | "ridge";
  pickingMode: boolean;
  rotatingMode: boolean;
  canRotate: boolean;
  onToggleRotating: () => void;
  drawnPointCount: number;
  ridgePointCount: number;
  manualParams: ManualParams;
  setManualParams: (p: ManualParams) => void;
  onStartPicking: () => void;
  onCancelPicking: () => void;
  onStartDrawing: () => void;
  onCancelDrawing: () => void;
  onProceedToRidge: () => void;
  onSkipRidge: () => void;
  onFinishDrawing: () => void;
  onUndoPoint: () => void;
};

function Section({
  title,
  children,
  step,
}: {
  title: string;
  step?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {step !== undefined && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
            {step}
          </span>
        )}
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

export default function Sidebar({
  address,
  setAddress,
  onSearchAddress,
  onAutoDetect,
  onLoadDemo,
  onCycleDemo,
  onRecenter,
  onClearAllModules,
  loading,
  error,
  building,
  providerLabel,
  providerReason,
  settings,
  setSettings,
  toggleFace,
  searchedLocation,
  drawingMode,
  drawingPhase,
  pickingMode,
  rotatingMode,
  canRotate,
  onToggleRotating,
  drawnPointCount,
  ridgePointCount,
  manualParams,
  setManualParams,
  onStartPicking,
  onCancelPicking,
  onStartDrawing,
  onCancelDrawing,
  onProceedToRidge,
  onSkipRidge,
  onFinishDrawing,
  onUndoPoint,
}: Props) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchAddress();
  };
  const hasLocation = searchedLocation !== null;

  const faces: RoofFace[] = building?.roofFaces ?? [];
  const approxCount = faces.filter(
    (f) => f.metadata?.approximation === true,
  ).length;

  return (
    <aside className="flex h-full w-[400px] flex-col border-l border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
            A&amp;B Solarenergy
          </p>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
            Beta
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-900">
          3D-Solarplaner
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Moderne Energietechnik. Maßgeschneidert für Ihr Dach.
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Section title="Haus suchen" step={1}>
          <form onSubmit={onSubmit} className="space-y-2">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="z. B. Mölndalstraße 8, 46325 Borken"
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-brand focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || address.trim().length === 0}
              className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
            >
              {loading ? "Suche …" : "Haus suchen"}
            </button>
            {hasLocation && (
              <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
                Standort gefunden. Wähle unten, wie das Dach modelliert
                werden soll.
              </p>
            )}
            {error && (
              <p className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                {error}
              </p>
            )}
          </form>
        </Section>

        <Section title="Dach festlegen" step={2}>
          <RoofConfigPanel
            hasLocation={hasLocation}
            loading={loading}
            drawingMode={drawingMode}
            drawingPhase={drawingPhase}
            pickingMode={pickingMode}
            rotatingMode={rotatingMode}
            canRotate={canRotate}
            drawnPointCount={drawnPointCount}
            ridgePointCount={ridgePointCount}
            manualParams={manualParams}
            setManualParams={setManualParams}
            onAutoDetect={onAutoDetect}
            onStartPicking={onStartPicking}
            onCancelPicking={onCancelPicking}
            onStartDrawing={onStartDrawing}
            onCancelDrawing={onCancelDrawing}
            onProceedToRidge={onProceedToRidge}
            onSkipRidge={onSkipRidge}
            onFinishDrawing={onFinishDrawing}
            onUndoPoint={onUndoPoint}
            onLoadDemo={onLoadDemo}
            onToggleRotating={onToggleRotating}
          />
        </Section>

        <Section title="Datenquelle" step={2}>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Aktiver Provider</span>
              <span className="font-semibold text-slate-900">
                {providerLabel ?? "—"}
              </span>
            </div>
            {building && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-slate-500">Confidence</span>
                <span className="text-slate-700">
                  {building.confidence !== undefined
                    ? `${Math.round(building.confidence * 100)} %`
                    : "n/a"}
                </span>
              </div>
            )}
            {providerReason && (
              <p className="mt-1 text-[11px] text-slate-500">{providerReason}</p>
            )}
            {approxCount > 0 && (
              <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                ⚠︎ {approxCount} Dachfläche(n) wurden approximiert.
              </p>
            )}
          </div>
        </Section>

        <Section title="Dachflächen" step={3}>
          <RoofFaceList faces={faces} onToggle={toggleFace} />
        </Section>

        <Section title="Moduleinstellungen" step={4}>
          <ModuleSettingsPanel settings={settings} onChange={setSettings} />
        </Section>

        <Section title="Kennzahlen" step={5}>
          <MetricsPanel
            building={building}
            providerName={providerLabel}
            onClearAllModules={onClearAllModules}
          />
        </Section>

        <Section title="Aktionen">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRecenter}
              className="col-span-2 rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Ansicht zentrieren
            </button>
            <button
              type="button"
              onClick={onCycleDemo}
              className="col-span-2 rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Demo-Gebäude wechseln
            </button>
          </div>
        </Section>

        <Section title="Debug">
          <JsonDebugPanel building={building} />
        </Section>

        <p className="rounded-md bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-600">
          Demo/Prototyp: Dachgeometrien können aus API-Daten, LoD2-Daten,
          OSM-Footprints, manueller Zeichnung oder Mock-Daten stammen.
          Approximierte Dachflächen sind nicht amtlich vermessen.
        </p>
      </div>
    </aside>
  );
}

/* ----------------------------- ManualDrawingPanel ----------------------------- */

const SHAPE_OPTIONS: { value: RoofShape; label: string }[] = [
  { value: "satteldach", label: "Satteldach" },
  { value: "walmdach", label: "Walmdach" },
  { value: "flachdach", label: "Flachdach" },
  { value: "pultdach", label: "Pultdach" },
];

type RoofConfigPanelProps = {
  hasLocation: boolean;
  loading: boolean;
  drawingMode: boolean;
  drawingPhase: "corners" | "ridge";
  pickingMode: boolean;
  rotatingMode: boolean;
  canRotate: boolean;
  drawnPointCount: number;
  ridgePointCount: number;
  manualParams: ManualParams;
  setManualParams: (p: ManualParams) => void;
  onAutoDetect: () => void;
  onStartPicking: () => void;
  onCancelPicking: () => void;
  onStartDrawing: () => void;
  onCancelDrawing: () => void;
  onProceedToRidge: () => void;
  onSkipRidge: () => void;
  onFinishDrawing: () => void;
  onUndoPoint: () => void;
  onLoadDemo: () => void;
  onToggleRotating: () => void;
};

function RoofConfigPanel({
  hasLocation,
  loading,
  drawingMode,
  drawingPhase,
  pickingMode,
  rotatingMode,
  canRotate,
  drawnPointCount,
  ridgePointCount,
  manualParams,
  setManualParams,
  onAutoDetect,
  onStartPicking,
  onCancelPicking,
  onStartDrawing,
  onCancelDrawing,
  onProceedToRidge,
  onSkipRidge,
  onFinishDrawing,
  onUndoPoint,
  onLoadDemo,
  onToggleRotating,
}: RoofConfigPanelProps) {
  const idle = !drawingMode && !pickingMode && !rotatingMode;
  const disabledIfNoLocation = !hasLocation || loading;
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      {!hasLocation && (
        <p className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
          Erst oben ein Haus suchen. Dann wählst du hier, wie das Dach
          modelliert werden soll.
        </p>
      )}

      {idle && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onAutoDetect}
            disabled={disabledIfNoLocation}
            className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
          >
            Dach automatisch erkennen
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onStartPicking}
              disabled={disabledIfNoLocation}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Haus auf Karte klicken
            </button>
            <button
              type="button"
              onClick={onStartDrawing}
              disabled={disabledIfNoLocation}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Eckpunkte + First zeichnen
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleRotating}
            disabled={!canRotate}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              !canRotate
                ? "Erst ein Haus per Klick wählen oder zeichnen, dann kann gedreht werden."
                : "Maus-Drag-Modus: drag auf der Karte dreht das Haus"
            }
          >
            ⟳ Mit Maus drehen
          </button>
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={loading}
            className="w-full rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            Demo-Gebäude laden
          </button>
        </div>
      )}

      {rotatingMode && (
        <>
          <p className="rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
            Drehen aktiv. Mausziehen auf der Karte dreht das Haus um seinen
            Mittelpunkt. Slider unten justiert fein.
          </p>
          <button
            type="button"
            onClick={onToggleRotating}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Drehen beenden
          </button>
        </>
      )}

      {pickingMode && (
        <>
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            Klick auf das Haus auf der Karte. App fragt OSM, baut das Modell
            mit deinen aktuellen Slider-Werten.
          </p>
          <button
            type="button"
            onClick={onCancelPicking}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Abbrechen
          </button>
        </>
      )}

      {drawingMode && drawingPhase === "corners" && (
        <>
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            Schritt 1 &mdash; Ecken: {drawnPointCount} Punkt
            {drawnPointCount === 1 ? "" : "e"} gesetzt.
            {drawnPointCount < 3 && " Mindestens 3 benötigt."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onUndoPoint}
              disabled={drawnPointCount === 0}
              className="rounded-md border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↶ Letzten
            </button>
            <button
              type="button"
              onClick={onCancelDrawing}
              className="rounded-md border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onSkipRidge}
              disabled={drawnPointCount < 3}
              className="rounded-md border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ohne First fertig
            </button>
            <button
              type="button"
              onClick={onProceedToRidge}
              disabled={drawnPointCount < 3}
              className="rounded-md bg-brand px-2 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
            >
              Weiter zur First →
            </button>
          </div>
        </>
      )}

      {drawingMode && drawingPhase === "ridge" && (
        <>
          <p className="rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
            Schritt 2 &mdash; First-Linie: {ridgePointCount}/2 Punkte gesetzt.
            {ridgePointCount < 2 && " Klicke 2 Punkte für die Firstrichtung."}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onUndoPoint}
              disabled={ridgePointCount === 0}
              className="rounded-md border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↶ Letzten
            </button>
            <button
              type="button"
              onClick={onCancelDrawing}
              className="rounded-md border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={onFinishDrawing}
              disabled={ridgePointCount < 2}
              className="rounded-md bg-brand px-2 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
            >
              Fertig
            </button>
          </div>
        </>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Dachform
        </p>
        <div className="grid grid-cols-2 gap-1">
          {SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setManualParams({ ...manualParams, shape: opt.value })
              }
              className={
                "rounded-md border px-2 py-1.5 text-xs font-medium transition " +
                (manualParams.shape === opt.value
                  ? "border-brand bg-brand-50 text-brand-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Dachneigung
          </label>
          <span className="text-xs font-medium text-slate-700">
            {manualParams.pitchDeg.toFixed(0)}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={manualParams.pitchDeg}
          onChange={(e) =>
            setManualParams({
              ...manualParams,
              pitchDeg: Number(e.target.value),
            })
          }
          disabled={manualParams.shape === "flachdach"}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Traufhöhe
          </label>
          <span className="text-xs font-medium text-slate-700">
            {manualParams.eaveHeightM.toFixed(1)} m
          </span>
        </div>
        <input
          type="range"
          min={2.5}
          max={12}
          step={0.5}
          value={manualParams.eaveHeightM}
          onChange={(e) =>
            setManualParams({
              ...manualParams,
              eaveHeightM: Number(e.target.value),
            })
          }
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Hausausrichtung (First)
          </label>
          <span className="text-xs font-medium text-slate-700">
            {manualParams.ridgeAzimuthDeg !== null
              ? `${Math.round(manualParams.ridgeAzimuthDeg)}°`
              : "auto"}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={179}
          step={1}
          value={manualParams.ridgeAzimuthDeg ?? 0}
          onChange={(e) =>
            setManualParams({
              ...manualParams,
              ridgeAzimuthDeg: Number(e.target.value),
            })
          }
          className="w-full accent-brand"
        />
        <p className="text-[10px] text-slate-500">
          0° = Nord-Süd · 90° = Ost-West. Schiebe nachträglich, falls die
          Drehung nicht passt.
        </p>
      </div>
    </div>
  );
}
