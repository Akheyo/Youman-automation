/**
 * GET /api/pvgis?lat=51.85&lng=6.85&kwp=8&tilt=30&azimuth=180
 *
 * Returns PVGIS yearly + monthly yield estimate. Aspect is computed
 * server-side from the NRW azimuth (0=N, 180=S, 270=W).
 */

import { NextResponse } from 'next/server';
import { fetchPvgisYield } from '@/lib/pvgis';
import { azimuthToPvgisAspect } from '@/lib/geo';
import { CALC } from '@/lib/calculator';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const kwp = parseFloat(searchParams.get('kwp') ?? '');
  const tilt = parseFloat(searchParams.get('tilt') ?? '30');
  const azimuth = parseFloat(searchParams.get('azimuth') ?? '180');

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(kwp) || kwp <= 0) {
    return NextResponse.json({ error: 'lat, lng und kwp (>0) erforderlich.' }, { status: 400 });
  }

  try {
    const result = await fetchPvgisYield({
      lat,
      lng,
      peakPowerKwp: kwp,
      tiltDeg: tilt,
      aspectDeg: azimuthToPvgisAspect(azimuth),
    });
    return NextResponse.json(result);
  } catch (err) {
    // Graceful degradation: NRW default 950 kWh/kWp, no monthly breakdown.
    const fallbackYearly = Math.round(kwp * CALC.KWH_PER_KWP_NRW);
    return NextResponse.json({
      yearlyKwh: fallbackYearly,
      monthlyKwh: [],
      _fallback: true,
      _fallbackReason: err instanceof Error ? err.message : String(err),
    });
  }
}
