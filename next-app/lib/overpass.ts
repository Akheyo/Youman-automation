/**
 * Overpass-API helpers used by the /api/buildings route.
 *
 * Why server-side:
 *  - Some networks/clients block direct CORS calls to Overpass.
 *  - We can apply timeouts + mirror failover without leaking it into the bundle.
 *  - The official mirror is rate-limited; the route can also cache later.
 */

import type { BuildingFootprint } from '@/types';

const DEFAULT_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const TIMEOUT_MS = 8_000;

function buildQuery(lat: number, lng: number, radiusM: number): string {
  // We want the geometry of all building ways/relations within `radiusM`.
  // `out geom tags` returns coordinates inline, no second request needed.
  return [
    '[out:json][timeout:25];',
    '(',
    `way[building](around:${radiusM},${lat},${lng});`,
    `relation[building](around:${radiusM},${lat},${lng});`,
    ');',
    'out geom tags;',
  ].join('');
}

interface OverpassElement {
  type: 'way' | 'relation';
  id: number;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function pickHeight(tags?: Record<string, string>): number | undefined {
  if (!tags) return undefined;
  const explicit = parseFloat(tags['height'] || tags['building:height'] || '');
  if (!Number.isNaN(explicit) && explicit > 0) return explicit;
  const levels = parseFloat(tags['building:levels'] || tags['levels'] || '');
  if (!Number.isNaN(levels) && levels > 0) return levels * 3.2;
  return undefined;
}

function elementToFootprint(el: OverpassElement): BuildingFootprint | null {
  // Ways have inline geometry; relations expose geometry on outer members.
  let geom = el.geometry;
  if (!geom && el.members) {
    const outer = el.members.find((m) => m.type === 'way' && (!m.role || m.role === 'outer'));
    geom = outer?.geometry;
  }
  if (!geom || geom.length < 3) return null;

  const ring: [number, number][] = geom.map((p) => [p.lon, p.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);

  return {
    id: el.id,
    coordinates: ring,
    height: pickHeight(el.tags),
    tags: el.tags,
  };
}

/**
 * Fetch building footprints around a coordinate from Overpass.
 * Tries every mirror in turn with an 8s timeout; throws if all fail.
 */
export async function fetchBuildings(
  lat: number,
  lng: number,
  radiusM = 80,
  customMirror?: string,
): Promise<BuildingFootprint[]> {
  const query = buildQuery(lat, lng, radiusM);
  const mirrors = customMirror ? [customMirror, ...DEFAULT_MIRRORS] : DEFAULT_MIRRORS;
  let lastError: unknown;

  for (const url of mirrors) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctl.signal,
      }).finally(() => clearTimeout(timer));

      if (!res.ok) {
        lastError = new Error(`${url}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as OverpassResponse;
      const elements = json.elements ?? [];
      const buildings = elements
        .map(elementToFootprint)
        .filter((b): b is BuildingFootprint => b !== null);
      return buildings;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    'Overpass-API not reachable: ' + (lastError instanceof Error ? lastError.message : String(lastError)),
  );
}
