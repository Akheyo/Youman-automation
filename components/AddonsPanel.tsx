'use client';

import { useApp } from '@/lib/store';
import { CALC } from '@/lib/calculator';

const ADDONS = [
  {
    key: 'storage' as const,
    title: 'Stromspeicher',
    desc: '10 kWh Lithium-Speicher. Hebt Eigenverbrauchsquote von ~32% auf ~70%.',
    cost: `+${CALC.EUR_STORAGE.toLocaleString('de-DE')} €`,
  },
  {
    key: 'wallbox' as const,
    title: 'Wallbox',
    desc: '11 kW Heim-Ladestation. +3.000 kWh Verbrauch/Jahr eingerechnet.',
    cost: `+${CALC.EUR_WALLBOX.toLocaleString('de-DE')} €`,
  },
  {
    key: 'heatpump' as const,
    title: 'Wärmepumpe',
    desc: 'Luft-Wasser. +4.500 kWh Verbrauch/Jahr. Anschaffung außerhalb der PV-Anlage.',
    cost: 'separat',
  },
];

export default function AddonsPanel() {
  const addons = useApp((s) => s.consumption.addons);
  const setAddon = useApp((s) => s.setAddon);

  return (
    <fieldset className="panel panel--addons">
      <legend>Zusatzkomponenten</legend>
      <ul className="addons">
        {ADDONS.map((a) => (
          <li key={a.key} className={`addon${addons[a.key] ? ' is-active' : ''}`}>
            <label className="addon__label">
              <input
                type="checkbox"
                checked={addons[a.key]}
                onChange={(e) => setAddon(a.key, e.target.checked)}
              />
              <span className="addon__title">{a.title}</span>
              <span className="addon__cost">{a.cost}</span>
            </label>
            <p className="addon__desc">{a.desc}</p>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
