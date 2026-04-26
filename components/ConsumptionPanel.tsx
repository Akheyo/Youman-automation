'use client';

import { useApp } from '@/lib/store';

const PERSON_PRESETS = [
  { label: '1–2 Pers.', kwh: 2500 },
  { label: '3–4 Pers.', kwh: 4500 },
  { label: '5+ Pers.', kwh: 6500 },
];

export default function ConsumptionPanel() {
  const consumption = useApp((s) => s.consumption);
  const setConsumption = useApp((s) => s.setConsumption);

  return (
    <fieldset className="panel panel--consumption">
      <legend>Stromverbrauch</legend>

      <div className="consumption__presets">
        {PERSON_PRESETS.map((p) => {
          const active = consumption.kwhYear === p.kwh;
          return (
            <button
              key={p.label}
              type="button"
              className={`chip${active ? ' is-active' : ''}`}
              onClick={() => setConsumption({ kwhYear: p.kwh })}
              aria-pressed={active}
            >
              {p.label}
              <span className="chip__sub">{p.kwh.toLocaleString('de-DE')} kWh</span>
            </button>
          );
        })}
      </div>

      <div className="row">
        <label className="field">
          <span>Verbrauch (kWh/Jahr)</span>
          <input
            type="number"
            min={500}
            max={30000}
            step={100}
            value={consumption.kwhYear}
            onChange={(e) => setConsumption({ kwhYear: parseInt(e.target.value, 10) || 0 })}
          />
        </label>

        <label className="field">
          <span>Strompreis (ct/kWh)</span>
          <input
            type="number"
            min={10}
            max={100}
            step={0.5}
            value={consumption.priceCtKwh}
            onChange={(e) => setConsumption({ priceCtKwh: parseFloat(e.target.value) || 0 })}
          />
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={consumption.hasEAuto}
          onChange={(e) => setConsumption({ hasEAuto: e.target.checked })}
        />
        <span>Ich fahre bereits ein E-Auto (informativ)</span>
      </label>
    </fieldset>
  );
}
