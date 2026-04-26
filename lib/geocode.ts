/**
 * Geocoding — Mapbox primary, Nominatim fallback.
 *
 * Both providers are called from /api/geocode (server-only) so we can:
 *   - hide the Mapbox secret token,
 *   - apply edge cache (5 min) for repeated identical queries,
 *   - swap providers without touching the UI.
 */

import type { AddressResult } from '@/types';

const MAPBOX_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

interface MapboxResponse {
  features?: MapboxFeature[];
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export async function geocodeMapbox(query: string, token: string, limit = 5): Promise<AddressResult[]> {
  const url = new URL(`${MAPBOX_BASE}/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('language', 'de');
  url.searchParams.set('country', 'de');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('types', 'address,poi,place');

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Mapbox HTTP ${res.status}`);
  const data = (await res.json()) as MapboxResponse;
  return (data.features ?? []).map((f) => ({
    id: f.id,
    placeName: f.place_name,
    center: f.center,
    source: 'mapbox' as const,
  }));
}

export async function geocodeNominatim(query: string, limit = 5): Promise<AddressResult[]> {
  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('countrycodes', 'de');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('accept-language', 'de');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim requires a real UA (rate-limit policy).
      'User-Agent': 'AB-Solarenergy-PV-Konfigurator/1.0 (admin@ab-solarenergy.de)',
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const arr = (await res.json()) as NominatimResult[];
  return arr.map((r) => ({
    id: `nom_${r.place_id}`,
    placeName: r.display_name,
    center: [parseFloat(r.lon), parseFloat(r.lat)],
    source: 'nominatim' as const,
  }));
}
