"use client";

import { useState } from "react";
import type { DetectedBuilding } from "@/types/solar";

type Props = {
  building: DetectedBuilding | null;
};

export default function JsonDebugPanel({ building }: Props) {
  const [open, setOpen] = useState(false);
  const json = building ? JSON.stringify(building, null, 2) : "(kein Gebäude)";
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span>JSON anzeigen</span>
        <span className="text-xs text-slate-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <div className="flex items-center justify-between px-3 py-1 text-xs text-slate-500">
            <span>DetectedBuilding (inkl. roofFaces, modules)</span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(json)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 hover:bg-slate-100"
            >
              Kopieren
            </button>
          </div>
          <pre className="max-h-72 overflow-auto bg-slate-900 px-3 py-2 text-[11px] leading-snug text-slate-100">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}
