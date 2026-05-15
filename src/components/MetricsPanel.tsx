"use client";

import type { DetectedBuilding, RoofFace } from "@/types/solar";
import { MAX_MODULES_PER_FACE } from "@/lib/constants";

type Props = {
  building: DetectedBuilding | null;
  providerName?: string | null;
  onClearAllModules?: () => void;
};

function formatArea(m2: number): string {
  return `${m2.toFixed(1)} m²`;
}

/**
 * Priorität für die Sortierung der Dachflächen: Süden zuerst, dann SO/SW,
 * dann Ost/West, dann NO/NW, Norden zuletzt. Innerhalb gleicher Priorität
 * sortieren wir absteigend nach Modulanzahl.
 */
function azimuthPriority(azimuthDeg: number): number {
  const a = ((azimuthDeg % 360) + 360) % 360;
  return Math.min(Math.abs(a - 180), 360 - Math.abs(a - 180));
}

function orientationLabel(azimuthDeg: number): string {
  const a = ((azimuthDeg % 360) + 360) % 360;
  const dirs = [
    "Nord",
    "Nord-Ost",
    "Ost",
    "Süd-Ost",
    "Süd",
    "Süd-West",
    "West",
    "Nord-West",
  ];
  const idx = Math.round(a / 45) % 8;
  return dirs[idx]!;
}

type FaceRow = {
  face: RoofFace;
  count: number;
  capacity: number;
  isFull: boolean;
};

function buildFaceRows(building: DetectedBuilding): FaceRow[] {
  const selected = building.roofFaces.filter((f) => f.selected);
  const rows = selected.map<FaceRow>((face) => {
    const count = building.modules.filter(
      (m) => m.roofFaceId === face.id,
    ).length;
    return {
      face,
      count,
      capacity: MAX_MODULES_PER_FACE,
      isFull: count >= MAX_MODULES_PER_FACE,
    };
  });
  rows.sort((a, b) => {
    const dp =
      azimuthPriority(a.face.azimuthDeg) - azimuthPriority(b.face.azimuthDeg);
    if (dp !== 0) return dp;
    return b.count - a.count;
  });
  return rows;
}

export default function MetricsPanel({
  building,
  providerName,
  onClearAllModules,
}: Props) {
  const totalArea = building?.metrics.totalRoofAreaM2 ?? 0;
  const selectedArea = building?.metrics.selectedRoofAreaM2 ?? 0;
  const moduleCount = building?.metrics.moduleCount ?? 0;
  const totalKwp = building?.metrics.totalKwp ?? 0;

  const faceRows = building ? buildFaceRows(building) : [];
  const sourceDisplay =
    providerName ?? (building?.source ? sourceLabel(building.source) : "—");

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <span className="text-slate-500">Module gesamt</span>
          <span className="font-semibold text-slate-900">{moduleCount}</span>
        </div>
        {faceRows.length > 0 && (
          <ul className="border-t border-slate-100">
            {faceRows.map((row) => (
              <li
                key={row.face.id}
                className="flex items-center justify-between px-3 py-1.5 text-xs"
              >
                <span className="truncate text-slate-600">
                  {row.face.label}
                  <span className="ml-1 text-slate-400">
                    · {orientationLabel(row.face.azimuthDeg)}
                  </span>
                </span>
                <span
                  className={
                    row.isFull
                      ? "font-semibold text-rose-600"
                      : "font-medium text-slate-800"
                  }
                >
                  {row.count} / {row.capacity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          <Row label="Gesamtfläche Dach" value={formatArea(totalArea)} />
          <Row label="Aktive Dachfläche" value={formatArea(selectedArea)} />
          <Row label="Anlagenleistung" value={`${totalKwp.toFixed(2)} kWp`} />
          <Row label="Datenquelle" value={sourceDisplay} muted />
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

      {onClearAllModules && moduleCount > 0 && (
        <button
          type="button"
          onClick={onClearAllModules}
          className="w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          Alle Module entfernen
        </button>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span
        className={muted ? "text-slate-600" : "font-semibold text-slate-900"}
      >
        {value}
      </span>
    </li>
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
    case "osm":
      return "OpenStreetMap";
    case "vision":
      return "Vision (Satellitenbild)";
    case "manual":
      return "Manuell";
  }
}
