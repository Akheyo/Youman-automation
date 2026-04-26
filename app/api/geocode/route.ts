/**
 * GET /api/geocode?q=...&limit=5
 *
 * Tries Mapbox first (better German address parsing); falls back to Nominatim
 * if the token is missing or Mapbox returns 5xx.
 */

import { NextResponse } from 'next/server';
import { geocodeMapbox, geocodeNominatim } from '@/lib/geocode';
import type { AddressResult } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10) || 5, 10);

  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] satisfies AddressResult[] });
  }

  const token = process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Try Mapbox first.
  if (token && !token.startsWith('pk.your_')) {
    try {
      const results = await geocodeMapbox(q, token, limit);
      if (results.length > 0) {
        return NextResponse.json({ results, provider: 'mapbox' });
      }
    } catch (err) {
      // fall through to Nominatim
      console.warn('[geocode] Mapbox failed, falling back to Nominatim:', err);
    }
  }

  // Fallback: Nominatim.
  try {
    const results = await geocodeNominatim(q, limit);
    return NextResponse.json({ results, provider: 'nominatim' });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Geocoding nicht erreichbar.',
        action: 'Mapbox-Token in .env.local setzen oder Internet-Verbindung prüfen.',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
