/**
 * GET /api/nrw-wfs?lat=51.85&lng=6.85
 *
 * Fetches roof segments from the LANUK Solarkataster (sk_dachflaechen) and
 * returns them as GeoJSON-friendly NrwRoofSegment[].
 *
 * Server-side fetch — no CORS proxy needed; we go directly to the WFS.
 */

import { NextResponse } from 'next/server';
import { fetchNrwSegments, isInNRW } from '@/lib/nrw-wfs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat und lng erforderlich.' }, { status: 400 });
  }

  if (!isInNRW(lat, lng)) {
    return NextResponse.json(
      {
        error: 'Adresse liegt außerhalb NRW.',
        action: 'Solarkataster-Daten sind aktuell nur für NRW verfügbar. Pilotregion: Borken.',
      },
      { status: 400 },
    );
  }

  const proxyPrefix = (process.env.NRW_WFS_PROXY ?? '').trim();
  const layer = process.env.NRW_WFS_LAYER || 'sk_dachflaechen';

  try {
    const segments = await fetchNrwSegments(lat, lng, {
      layer,
      // Server-side: no proxy needed (direct call). Empty string opts out of corsproxy.io.
      proxyPrefix: proxyPrefix === '' ? '' : proxyPrefix,
    });
    return NextResponse.json({ segments });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'NRW Solarkataster (LANUK WFS) nicht erreichbar.',
        action: 'Service kann temporär down sein. Eigenen CORS-Proxy via NRW_WFS_PROXY setzen.',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
