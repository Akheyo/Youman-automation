/**
 * PVGIS — EU JRC's PV yield calculator.
 *
 * Endpoint: https://re.jrc.ec.europa.eu/api/v5_2/PVcalc
 * Free, no auth, EU-hosted (no DSGVO concerns for IP-only request).
 *
 * Note: PVGIS uses `aspect` where 0=South, +90=West, -90=East. Our internal
 * azimuth convention matches the NRW Solarkataster (0=N, 180=S, 270=W).
 * Use `azimuthToPvgisAspect` from lib/geo.ts for the conversion.
 */

import type { PVGISResult } from '@/types';

const PVGIS_BASE = 'https://re.jrc.ec.europa.eu/api/v5_2/PVcalc';

export interface PvgisOptions {
  lat: number;
  lng: number;
  /** System size in kWp (used for E_y normalisation). */
  peakPowerKwp: number;
  /** Roof tilt in degrees (0=flat, 90=vertical). */
  tiltDeg: number;
  /** PVGIS aspect: 0=S, +90=W, -90=E. Convert from NRW azimuth via geo.azimuthToPvgisAspect. */
  aspectDeg: number;
  /** System losses (%, default 14% — covers cabling, inverter, soiling). */
  lossPercent?: number;
  signal?: AbortSignal;
}

interface PvgisRawResponse {
  outputs?: {
    monthly?: { fixed?: { month: number; E_m: number }[] };
    totals?: { fixed?: { E_y?: number; E_d?: number } };
  };
  inputs?: {
    mounting_system?: {
      fixed?: { slope?: { value?: number } };
    };
  };
}

export async function fetchPvgisYield(opts: PvgisOptions): Promise<PVGISResult> {
  const params = new URLSearchParams({
    lat: opts.lat.toFixed(5),
    lon: opts.lng.toFixed(5),
    raddatabase: 'PVGIS-SARAH2',
    peakpower: opts.peakPowerKwp.toFixed(2),
    pvtechchoice: 'crystSi',
    mountingplace: 'building',
    loss: String(opts.lossPercent ?? 14),
    angle: String(Math.round(opts.tiltDeg)),
    aspect: String(Math.round(opts.aspectDeg)),
    outputformat: 'json',
  });

  const res = await fetch(`${PVGIS_BASE}?${params.toString()}`, { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`PVGIS HTTP ${res.status}`);
  }
  const data = (await res.json()) as PvgisRawResponse;

  const totals = data.outputs?.totals?.fixed;
  const yearlyKwh = totals?.E_y;
  if (typeof yearlyKwh !== 'number' || !Number.isFinite(yearlyKwh)) {
    throw new Error('PVGIS: kein E_y im Response');
  }

  const monthlyKwh = (data.outputs?.monthly?.fixed ?? [])
    .filter((m) => typeof m?.E_m === 'number')
    .map((m) => m.E_m);

  return {
    yearlyKwh,
    monthlyKwh,
  };
}
