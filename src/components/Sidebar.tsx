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

import RoofFaceList from "./RoofFaceList";
import ModuleSettingsPanel from "./ModuleSettingsPanel";
import MetricsPanel from "./MetricsPanel";
import JsonDebugPanel from "./JsonDebugPanel";

type Props = {
  address: string;
  setAddress: (a: string) => void;
  onDetect: () => void;
  onLoadDemo: () => void;
  onCycleDemo: () => void;
  onRecenter: () => void;
  onReplaceModules: () => void;
  loading: boolean;
  error: string | null;
  building: DetectedBuilding | null;
  providerLabel: string | null;
  providerReason: string | null;
  settings: ModuleSettings;
  setSettings: (s: ModuleSettings) => void;
  toggleFace: (id: string) => void;
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
  onDetect,
  onLoadDemo,
  onCycleDemo,
  onRecenter,
  onReplaceModules,
  loading,
  error,
  building,
  providerLabel,
  providerReason,
  settings,
  setSettings,
  toggleFace,
}: Props) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    onDetect();
  };

  const faces: RoofFace[] = building?.roofFaces ?? [];
  const approxCount = faces.filter(
    (f) => f.metadata?.approximation === true,
  ).length;

  return (
    <aside className="flex h-full w-[380px] flex-col border-l border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-brand-600">
            Youman · Prototyp
          </p>
          <h1 className="text-base font-semibold text-slate-900">
            3D-Solarplaner
          </h1>
        </div>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
          MVP
        </span>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Section title="Adresseingabe" step={1}>
          <form onSubmit={onSubmit} className="space-y-2">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="z. B. Marienplatz, München"
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-brand focus:outline-none"
              disabled={loading}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || address.trim().length === 0}
                className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
              >
                {loading ? "Erkenne …" : "Dach automatisch erkennen"}
              </button>
              <button
                type="button"
                onClick={onLoadDemo}
                disabled={loading}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                Demo laden
              </button>
            </div>
            {error && (
              <p className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                {error}
              </p>
            )}
          </form>
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
          <MetricsPanel building={building} providerName={providerLabel} />
        </Section>

        <Section title="Aktionen">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRecenter}
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Ansicht zentrieren
            </button>
            <button
              type="button"
              onClick={onReplaceModules}
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Module neu platzieren
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
          Demo/Prototyp: Dachgeometrien können aus API-Daten, LoD2-Daten oder
          Mock-Daten stammen. Approximierte Dachflächen sind nicht amtlich
          vermessen.
        </p>
      </div>
    </aside>
  );
}
