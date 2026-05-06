"use client";

import type { DetectedBuilding } from "@/types/solar";

type Props = {
  building: DetectedBuilding | null;
  providerName?: string | null;
};

function formatArea(m2: number): string {
  return `${m2.toFixed(1)} m²`;
}

export default function MetricsPanel({ building, providerName }: Props) {
  const totalArea = building?.metrics.totalRoofAreaM2 ?? 0;
  const selectedArea = building?.metrics.selectedRoofAreaM2 ?? 0;
  const moduleCount = building?.metrics.moduleCount ?? 0;
  const totalKwp = building?.metrics.totalKwp ?? 0;

  const items: Array<{ label: string; value: string; muted?: boolean }> = [
    { label: "Gesamtfläche Dach", value: formatArea(totalArea) },
    { label: "Aktive Dachfläche", value: formatArea(selectedArea) },
    { label: "Anzahl Module", value: String(moduleCount) },
    { label: "Gesamtleistung", value: `${totalKwp.toFixed(2)} kWp` },
    {
      label: "Datenquelle",
      value:
        providerName ??
        (building?.source ? sourceLabel(building.source) : "—"),
      muted: true,
    },
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li
            key={it.label}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span className="text-slate-500">{it.label}</span>
            <span
              className={
                it.muted ? "text-slate-600" : "font-semibold text-slate-900"
              }
            >
              {it.value}
            </span>
          </li>
        ))}
      </ul>
      {building?.warnings && building.warnings.length > 0 && (
        <div className="border-t border-slate-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-medium">Hinweise</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {building.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function sourceLabel(s: DetectedBuilding["source"]): string {
  switch (s) {
    case "mock":
      return "Mock";
    case "google-solar":
      return "Google Solar API";
    case "lod2":
      return "LoD2";
    case "manual":
      return "Manuell";
  }
}
