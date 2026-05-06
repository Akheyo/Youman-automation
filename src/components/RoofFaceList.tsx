"use client";

import type { RoofFace } from "@/types/solar";

type Props = {
  faces: RoofFace[];
  onToggle: (id: string) => void;
};

function formatAzimuth(az: number): string {
  const dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  const idx = Math.round(((az % 360) + 360) / 45) % 8;
  return `${Math.round(az)}° (${dirs[idx]})`;
}

export default function RoofFaceList({ faces, onToggle }: Props) {
  if (faces.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Noch keine Dachflächen erkannt. Adresse eingeben oder Demo laden.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {faces.map((f) => (
        <li key={f.id} className="px-3 py-2">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={f.selected}
              onChange={() => onToggle(f.id)}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {f.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                  {f.source}
                </span>
              </div>
              <dl className="mt-1 grid grid-cols-3 gap-x-2 text-xs text-slate-600">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                    Fläche
                  </dt>
                  <dd>{f.areaM2.toFixed(1)} m²</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                    Neigung
                  </dt>
                  <dd>{f.pitchDeg.toFixed(0)}°</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                    Ausrichtung
                  </dt>
                  <dd>{formatAzimuth(f.azimuthDeg)}</dd>
                </div>
              </dl>
              {f.metadata?.approximation === true && (
                <p className="mt-1 text-[11px] text-amber-700">
                  ⚠︎ Approximierte Geometrie
                </p>
              )}
            </div>
          </label>
        </li>
      ))}
    </ul>
  );
}
