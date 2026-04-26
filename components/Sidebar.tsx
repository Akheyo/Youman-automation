'use client';

import { useEffect } from 'react';
import { useApp } from '@/lib/store';
import { calculate } from '@/lib/calculator';
import ConsumptionPanel from './ConsumptionPanel';
import AddonsPanel from './AddonsPanel';

const fmt = (n: number, opts?: Intl.NumberFormatOptions) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: 0, ...opts });

const fmt1 = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function Sidebar() {
  const layout = useApp((s) => s.layout);
  const yearlyYieldKwh = useApp((s) => s.yearlyYieldKwh);
  const consumption = useApp((s) => s.consumption);
  const result = useApp((s) => s.result);
  const setResult = useApp((s) => s.setResult);

  // Re-calculate whenever inputs change.
  useEffect(() => {
    if (!layout || layout.totalKwp === 0) {
      setResult(null);
      return;
    }
    const computed = calculate({
      availableKwp: layout.totalKwp,
      yearlyYieldKwh: yearlyYieldKwh > 0 ? yearlyYieldKwh : layout.totalKwp * 950,
      consumption,
    });
    setResult(computed);
  }, [layout, yearlyYieldKwh, consumption, setResult]);

  return (
    <aside className="sidebar">
      <ConsumptionPanel />
      <AddonsPanel />

      <section className="panel panel--result" aria-label="Ergebnis">
        <h3>Wirtschaftlichkeit</h3>
        {!result || !layout ? (
          <p className="panel__empty">
            Bitte zuerst Adresse eingeben und Dachflächen auswählen.
          </p>
        ) : (
          <dl className="kpis">
            <Kpi label="Module" value={fmt(result.moduleCount)} unit="× 400 Wp" />
            <Kpi label="Anlagengröße" value={fmt1(result.recommendedKwp)} unit="kWp" />
            <Kpi label="Jahresertrag" value={fmt(result.yearlyYieldKwh)} unit="kWh" />
            <Kpi label="Eigenverbrauch" value={fmt(result.selfConsumptionKwh)} unit="kWh" />
            <Kpi label="Einspeisung" value={fmt(result.feedInKwh)} unit="kWh" />
            <Kpi label="Ersparnis / Jahr" value={fmt(result.yearlySavingsEur)} unit="€" highlight />
            <Kpi label="Investition" value={fmt(result.investmentEur)} unit="€" />
            <Kpi label="Amortisation" value={fmt1(result.paybackYears)} unit="Jahre" />
            <Kpi label="CO₂-Einsparung" value={fmt1(result.co2SavingsT)} unit="t/Jahr" />
            <Kpi label="≈ Bäume" value={fmt(result.treesEquivalent)} unit="Stück" />
          </dl>
        )}
      </section>
    </aside>
  );
}

function Kpi({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`kpi${highlight ? ' kpi--highlight' : ''}`}>
      <dt>{label}</dt>
      <dd>
        <span className="kpi__value">{value}</span>
        <span className="kpi__unit"> {unit}</span>
      </dd>
    </div>
  );
}
