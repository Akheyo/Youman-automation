'use client';

/**
 * Sidebar — address, area, panel count, kWp, and bonus controls.
 */

import type { PVResult, RoofOrientation } from '@/types';

interface Props {
  result: PVResult | null;
  loading: boolean;
  error: string | null;
  editMode: boolean;
  onEditToggle(): void;
  orientation: RoofOrientation;
  onOrientationChange(o: RoofOrientation): void;
  onExportPdf(): void;
}

const fmt = (v: number, decimals = 0) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export default function Sidebar({
  result,
  loading,
  error,
  editMode,
  onEditToggle,
  orientation,
  onOrientationChange,
  onExportPdf,
}: Props) {
  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="sidebar__brand">PV-Konfigurator</div>
        <div className="sidebar__sub">Adresse → 3D-Haus → PV-Belegung</div>
      </header>

      {error && <div className="sidebar__alert">{error}</div>}

      <section className="sidebar__section">
        <h3 className="sidebar__h3">Adresse</h3>
        <div className="sidebar__value sidebar__value--addr">
          {loading ? 'Lade …' : result?.address.placeName ?? 'Bitte oben eingeben.'}
        </div>
      </section>

      <section className="sidebar__section">
        <h3 className="sidebar__h3">Dachfläche</h3>
        <div className="sidebar__metric">
          <span className="sidebar__big">{result ? fmt(result.areaM2, 0) : '—'}</span>
          <span className="sidebar__unit">m²</span>
        </div>
      </section>

      <section className="sidebar__section">
        <h3 className="sidebar__h3">Module</h3>
        <div className="sidebar__metric">
          <span className="sidebar__big">{result ? fmt(result.layout.count, 0) : '—'}</span>
          <span className="sidebar__unit">Stk · 1,7 × 1,1 m</span>
        </div>
      </section>

      <section className="sidebar__section">
        <h3 className="sidebar__h3">Anlagengröße</h3>
        <div className="sidebar__metric">
          <span className="sidebar__big">{result ? fmt(result.layout.totalKwp, 1) : '—'}</span>
          <span className="sidebar__unit">kWp</span>
        </div>
      </section>

      {result?.estimatedYearlyKwh !== undefined && (
        <section className="sidebar__section">
          <h3 className="sidebar__h3">Jahresertrag (geschätzt)</h3>
          <div className="sidebar__metric">
            <span className="sidebar__big">{fmt(result.estimatedYearlyKwh, 0)}</span>
            <span className="sidebar__unit">kWh / Jahr</span>
          </div>
        </section>
      )}

      <section className="sidebar__section">
        <h3 className="sidebar__h3">Ausrichtung</h3>
        <label className="sidebar__field">
          <span>Neigung</span>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={orientation.tiltDeg}
            onChange={(e) =>
              onOrientationChange({ ...orientation, tiltDeg: Number(e.target.value) })
            }
          />
          <span className="sidebar__field__val">{orientation.tiltDeg}°</span>
        </label>
        <label className="sidebar__field">
          <span>Azimut</span>
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={orientation.azimuthDeg}
            onChange={(e) =>
              onOrientationChange({ ...orientation, azimuthDeg: Number(e.target.value) })
            }
          />
          <span className="sidebar__field__val">{orientation.azimuthDeg}°</span>
        </label>
        <div className="sidebar__hint">0° = Nord · 90° = Ost · 180° = Süd · 270° = West</div>
      </section>

      <section className="sidebar__section sidebar__section--actions">
        <button
          type="button"
          className={'sidebar__btn ' + (editMode ? 'sidebar__btn--active' : '')}
          onClick={onEditToggle}
          disabled={!result}
        >
          {editMode ? 'Bearbeitung beenden' : 'Polygon bearbeiten'}
        </button>
        <button
          type="button"
          className="sidebar__btn sidebar__btn--primary"
          onClick={onExportPdf}
          disabled={!result}
        >
          Als PDF exportieren
        </button>
      </section>

      <footer className="sidebar__footer">
        Daten: OpenStreetMap (Overpass) · Karte: Mapbox · Berechnung: Turf.js
      </footer>
    </aside>
  );
}
