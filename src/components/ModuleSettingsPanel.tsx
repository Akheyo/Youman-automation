"use client";

import type { ModuleSettings } from "@/types/solar";

type Props = {
  settings: ModuleSettings;
  onChange: (next: ModuleSettings) => void;
};

function NumField({
  label,
  value,
  step = 0.01,
  min,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  unit?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-slate-600">{label}</span>
      <div className="flex items-stretch overflow-hidden rounded-md border border-slate-300 bg-white">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent px-2 py-1.5 text-sm focus:outline-none"
        />
        {unit && (
          <span className="border-l border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

export default function ModuleSettingsPanel({ settings, onChange }: Props) {
  const update = (patch: Partial<ModuleSettings>) =>
    onChange({ ...settings, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumField
        label="Modul Wp"
        value={settings.moduleWp}
        step={5}
        min={50}
        unit="Wp"
        onChange={(n) => update({ moduleWp: n })}
      />
      <NumField
        label="Modulbreite"
        value={settings.moduleWidthM}
        step={0.01}
        min={0.3}
        unit="m"
        onChange={(n) => update({ moduleWidthM: n })}
      />
      <NumField
        label="Modullänge"
        value={settings.moduleLengthM}
        step={0.01}
        min={0.5}
        unit="m"
        onChange={(n) => update({ moduleLengthM: n })}
      />
      <NumField
        label="Randabstand"
        value={settings.edgeMarginM}
        step={0.05}
        min={0}
        unit="m"
        onChange={(n) => update({ edgeMarginM: n })}
      />
      <NumField
        label="Modulabstand"
        value={settings.moduleGapM}
        step={0.01}
        min={0}
        unit="m"
        onChange={(n) => update({ moduleGapM: n })}
      />
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-slate-600">Ausrichtung</span>
        <select
          value={settings.orientation}
          onChange={(e) =>
            update({ orientation: e.target.value as "portrait" | "landscape" })
          }
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="portrait">Hochkant (portrait)</option>
          <option value="landscape">Querformat (landscape)</option>
        </select>
      </label>
    </div>
  );
}
