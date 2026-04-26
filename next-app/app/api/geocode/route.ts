/**
 * Mapbox Geocoding proxy.
 *
 * Why proxy:
 *   - Lets us hide a secret token (rate-limit-free) on the server.
 *   - Lets us add caching/throttling later without changing the UI.
 *
 * Endpoint:
 *   GET /api/geocode?q=Mölndalstraße+8+Borken&country=de&limit=5
 */

import { NextResponse } from 'next/server';
import type { AddressResult } from '@/types';

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

interface MapboxResponse {
  features?: MapboxFeature[];
}

const MAPBOX_GEOCODING = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const country = searchParams.get('country') ?? 'de';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10) || 5, 10);

  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] satisfies AddressResult[] });
  }

  const token = process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Mapbox token missing. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.' },
      { status: 500 },
    );
  }

  const url = new URL(`${MAPBOX_GEOCODING}/${encodeURIComponent(q)}.json`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('language', 'de');
  url.searchParams.set('country', country);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('types', 'address,poi,place');

  try {
    const res = await fetch(url.toString(), {
      // Cache identical queries for 5 min on the edge.
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Mapbox HTTP ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as MapboxResponse;
    const results: AddressResult[] = (data.features ?? []).map((f) => ({
      id: f.id,
      placeName: f.place_name,
      center: f.center,
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: 'Geocoding failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 502 },
    );
  }
}
