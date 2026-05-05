'use client';

/**
 * Manuelles Dachgeometrie-Panel.
 *
 * Direkte UI-Umsetzung des A&B-Excel-Sheets:
 *
 *   Inputs    →   First-Länge, Hausbreite, Dachneigung,
 *                 Wp/Modul, Modul-m², Dachform, Ausrichtung pro Seite
 *   Outputs   →   Hypotenuse C, Dachfläche pro Seite, Modulanzahl pro Seite,
 *                 kWp pro Seite, Gesamt-kWp, Anlagenertrag pro Seite und gesamt
 *
 * Wird angezeigt wenn der User "Dach manuell konfigurieren" aktiviert oder
 * wenn keine NRW-Solarkataster-Daten verfügbar sind (z. B. außerhalb NRW).
 *
 * Reine Berechnung — alle Formeln in `lib/roof-geometry.ts` und
 * `lib/yield-table.ts`. Diese Komponente ist nur die Sichtbarkeit.
 */

import { useMemo } from 'react';
import { computeRoofGeometry, type Aspect, type RoofType } from '@/lib/roof-geometry';
import { regionFromPlz, totalYield, yieldPerSide, REGION_LABEL } from '@/lib/yield-table';

interface Props {
  firstLengthM: number;
  houseWidthM: number;
  pitchDeg: number;
  panelWattPeak: number;
  panelAreaM2: number;
  roofType: RoofType;
  aspectA: Aspect;
  aspectB: Aspect;
  /** Nur für Walmdach genutzt. */
  aspectC?: Aspect;
  aspectD?: Aspect;
  /** PLZ zur Bestimmung der Region. Wenn null → Durchschnitt. */
  plz?: string | null;
  onChange: (patch: Partial<ManualRoofValues>) => void;
}

export interface ManualRoofValues {
  firstLengthM: number;
  houseWidthM: number;
  pitchDeg: number;
  panelWattPeak: number;
  panelAreaM2: number;
  roofType: RoofType;
  aspectA: Aspect;
  aspectB: Aspect;
  aspectC?: Aspect;
  aspectD?: Aspect;
}

const ASPECTS: { value: Aspect; label: string }[] = [
  { value: 'sued', label: 'Süd' },
  { value: 'ost', label: 'Ost' },
  { value: 'west', label: 'West' },
  { value: 'nord', label: 'Nord' },
];

const ROOF_TYPES: { value: RoofType; label: string }[] = [
  { value: 'satteldach', label: 'Satteldach (2 Seiten)' },
  { value: 'walmdach', label: 'Walmdach (4 Seiten)' },
  { value: 'pultdach', label: 'Pultdach (1 Seite)' },
];

export default function ManualRoofPanel(props: Props) {
  const {
    firstLengthM, houseWidthM, pitchDeg, panelWattPeak, panelAreaM2,
    roofType, aspectA, aspectB, aspectC, aspectD, plz, onChange,
  } = props;

  const region = useMemo(() => regionFromPlz(plz ?? null), [plz]);

  const geom = useMemo(
    () => computeRoofGeometry({
      firstLengthM, houseWidthM, pitchDeg,
      panelWattPeak, panelAreaM2, roofType,
    }),
    [firstLengthM, houseWidthM, pitchDeg, panelWattPeak, panelAreaM2, roofType],
  );

  const sideAspect = (label: 'A' | 'B' | 'C' | 'D'): Aspect => {
    switch (label) {
      case 'A': return aspectA;
      case 'B': return aspectB;
      case 'C': return aspectC ?? 'nord';
      case 'D': return aspectD ?? 'sued';
    }
  };

  const yieldSides = geom.sides.map((s) => ({
    label: s.label,
    aspect: sideAspect(s.label),
    kwp: s.kwp,
    yieldKwh: yieldPerSide(s.kwp, region, sideAspect(s.label)),
  }));
  const totalYieldKwh = totalYield(
    yieldSides.map((s) => ({ kwp: s.kwp, aspect: s.aspect })),
    region,
  );

  return (
    <div className="manual-roof">
      <div className="manual-roof__inputs">
        <h3>Dach-Geometrie</h3>

        <label className="manual-roof__field">
          <span>Dachform</span>
          <select
            value={roofType}
            onChange={(e) => onChange({ roofType: e.target.value as RoofType })}
          >
            {ROOF_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="manual-roof__field">
          <span>Länge First (m)</span>
          <input
            type="number" min={1} max={50} step={0.1}
            value={firstLengthM}
            onChange={(e) => onChange({ firstLengthM: Number(e.target.value) || 0 })}
          />
        </label>

        <label className="manual-roof__field">
          <span>Breite Haus (m)</span>
          <input
            type="number" min={1} max={30} step={0.1}
            value={houseWidthM}
            onChange={(e) => onChange({ houseWidthM: Number(e.target.value) || 0 })}
          />
        </label>

        <label className="manual-roof__field">
          <span>Dachneigung (°)</span>
          <input
            type="number" min={5} max={60} step={1}
            value={pitchDeg}
            onChange={(e) => onChange({ pitchDeg: Number(e.target.value) || 0 })}
          />
        </label>

        <h4>Modul</h4>

        <label className="manual-roof__field">
          <span>Wp pro Modul</span>
          <input
            type="number" min={300} max={650} step={5}
            value={panelWattPeak}
            onChange={(e) => onChange({ panelWattPeak: Number(e.target.value) || 0 })}
          />
        </label>

        <label className="manual-roof__field">
          <span>Modul-Fläche (m²)</span>
          <input
            type="number" min={1} max={3} step={0.05}
            value={panelAreaM2}
            onChange={(e) => onChange({ panelAreaM2: Number(e.target.value) || 0 })}
          />
        </label>

        <h4>Ausrichtung</h4>

        <label className="manual-roof__field">
          <span>Seite A</span>
          <select value={aspectA} onChange={(e) => onChange({ aspectA: e.target.value as Aspect })}>
            {ASPECTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>

        {roofType !== 'pultdach' && (
          <label className="manual-roof__field">
            <span>Seite B</span>
            <select value={aspectB} onChange={(e) => onChange({ aspectB: e.target.value as Aspect })}>
              {ASPECTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
        )}

        {roofType === 'walmdach' && (
          <>
            <label className="manual-roof__field">
              <span>Seite C (Walm)</span>
              <select value={aspectC ?? 'nord'} onChange={(e) => onChange({ aspectC: e.target.value as Aspect })}>
                {ASPECTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
            <label className="manual-roof__field">
              <span>Seite D (Walm)</span>
              <select value={aspectD ?? 'sued'} onChange={(e) => onChange({ aspectD: e.target.value as Aspect })}>
                {ASPECTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="manual-roof__outputs">
        <h3>Ergebnis (Excel-Formeln)</h3>

        <table className="manual-roof__table">
          <thead>
            <tr>
              <th>Seite</th>
              <th>Ausrichtung</th>
              <th>Hypotenuse&nbsp;(m)</th>
              <th>Fläche&nbsp;(m²)</th>
              <th>Module</th>
              <th>kWp</th>
              <th>Ertrag&nbsp;(kWh/Jahr)</th>
            </tr>
          </thead>
          <tbody>
            {geom.sides.map((s, i) => (
              <tr key={s.label}>
                <td>{s.label}</td>
                <td>{ASPECTS.find((a) => a.value === yieldSides[i]!.aspect)?.label}</td>
                <td>{s.hypotenuseM.toFixed(2)}</td>
                <td>{s.areaM2.toFixed(2)}</td>
                <td>{s.panelCount}</td>
                <td>{s.kwp.toFixed(2)}</td>
                <td>{yieldSides[i]!.yieldKwh.toLocaleString('de-DE')}</td>
              </tr>
            ))}
            <tr className="manual-roof__total">
              <td colSpan={3}>Gesamt</td>
              <td>{geom.totalAreaM2.toFixed(2)}</td>
              <td>{geom.totalPanels}</td>
              <td>{geom.totalKwp.toFixed(2)}</td>
              <td>{totalYieldKwh.toLocaleString('de-DE')}</td>
            </tr>
          </tbody>
        </table>

        <p className="manual-roof__region">
          Region:&nbsp;
          {region ? <strong>{REGION_LABEL[region]}</strong> : <em>unbekannt — Bundesschnitt</em>}
          {plz && (<span> · PLZ {plz}</span>)}
        </p>
      </div>
    </div>
  );
}
