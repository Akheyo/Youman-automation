/**
 * Building footprint endpoint.
 *
 * GET /api/buildings?lat=51.85&lng=6.85&radius=80
 *
 * Returns:
 *   {
 *     buildings: BuildingFootprint[],
 *     selected: BuildingFootprint | null   // closest to address point
 *   }
 */

import { NextResponse } from 'next/server';
import { fetchBuildings } from '@/lib/overpass';
import { pickClosestBuilding } from '@/lib/geo';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = Math.min(parseInt(searchParams.get('radius') ?? '80', 10) || 80, 250);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  try {
    const buildings = await fetchBuildings(lat, lng, radius, process.env.OVERPASS_URL || undefined);
    const selected = pickClosestBuilding(buildings, lng, lat);
    return NextResponse.json({ buildings, selected });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
