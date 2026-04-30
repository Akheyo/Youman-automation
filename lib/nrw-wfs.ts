/**
 * NRW LANUK Solarkataster (Sk_Dachflaechen) WFS client.
 *
 * Endpoint: https://www.wfs.nrw.de/umwelt/erneuerbare_energien_wfs
 * Layer:    sk_dachflaechen
 * License:  Datenlizenz Deutschland Zero - Version 2.0 (free commercial use)
 *
 * The WFS does not currently support CORS. We have two paths:
 *   1. (preferred, production) host a tiny Cloudflare Worker that proxies
 *      to the WFS, and set NRW_WFS_PROXY=https://your-worker.workers.dev/?
 *   2. (development) fall back to corsproxy.io — public, rate-limited,
 *      DO NOT use in production.
 *
 * Both modes are encoded here. In server-side runtimes (Next.js API route)
 * we can call the WFS directly without any proxy.
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, FeatureCollection } from 'geojson';
import type { BuildingFootprint, NrwRoofSegment, RoofSuitability } from '@/types';
import { bboxAround, buildingToFeature } from './geo';

const WFS_BASE = 'https://www.wfs.nrw.de/umwelt/erneuerbare_energien_wfs';
const DEFAULT_LAYER = 'sk_dachflaechen';
const PUBLIC_CORS_PROXY = 'https://corsproxy.io/?';

/** Bounding box around (lat, lng) — needs to be wide enough that the whole
 *  building plus a small surround is captured (segments often extend a few m
 *  past the OSM footprint). */
const BBOX_PADDING_M = 30;

/**
 * Layer-name variants tried in order. NRW has renamed and reorganised the
 * Solarkataster a few times; we try the most common names so a single rename
 * doesn't kill the integration.
 */
const LAYER_FALLBACKS = [
  'sk_dachflaechen',
  'erneuerbare_energien:sk_dachflaechen',
  'sk:dachflaechen',
  'dachflaechen',
];

export interface FetchNrwSegmentsOptions {
  /** Override layer name (default `sk_dachflaechen`). */
  layer?: string;
  /** Use a custom WFS proxy URL prefix instead of corsproxy.io. Server-only environments can pass `''` to call WFS directly. */
  proxyPrefix?: string;
  /** Padding around (lat,lng) in meters. */
  paddingM?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export function isInNRW(lat: number, lng: number): boolean {
  return lat >= 50.32 && lat <= 52.53 && lng >= 5.86 && lng <= 9.46;
}

interface NrwFeatureProps {
  azimuth?: number;
  azimut?: number;
  ausrichtung?: number;
  exposition?: number;
  neigung?: number;
  tilt?: number;
  pitch?: number;
  dachneigung?: number;
  geeignete_flaeche_m2?: number;
  flaeche?: number;
  area?: number;
  nutzbare_flaeche?: number;
  ertrag_kwh?: number;
  ertrag?: number;
  yearly_kwh?: number;
  solarertrag?: number;
  module_anzahl?: number;
  modulanzahl?: number;
  modules?: number;
  eignung?: string;
  klassifikation?: string;
  bewertung?: string;
}

function num(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseSuitability(value: string | undefined): RoofSuitability {
  if (!value) return 'gut';
  const v = value.toLowerCase();
  if (v.includes('sehr')) return 'sehr gut';
  if (v.includes('ungeeignet') || v.includes('schlecht')) return 'ungeeignet';
  if (v.includes('bedingt') || v.includes('mittel')) return 'bedingt';
  if (v.includes('gut')) return 'gut';
  return 'gut';
}

export async function fetchNrwSegments(
  lat: number,
  lng: number,
  opts: FetchNrwSegmentsOptions = {},
): Promise<NrwRoofSegment[]> {
  if (!isInNRW(lat, lng)) {
    throw new Error('Adresse liegt außerhalb NRW. Solarkataster nur für NRW verfügbar.');
  }

  const padding = opts.paddingM ?? BBOX_PADDING_M;
  const proxyPrefix = opts.proxyPrefix ?? PUBLIC_CORS_PROXY;

  const [minLng, minLat, maxLng, maxLat] = bboxAround(lat, lng, padding);

  // We try every layer-name variant + both BBOX axis orderings. NRW WFS has
  // shipped both interpretations of EPSG:4326 over the years, so we don't
  // assume — we probe.
  const layerCandidates = opts.layer ? [opts.layer] : LAYER_FALLBACKS;
  const bboxCandidates = [
    `${minLat},${minLng},${maxLat},${maxLng},EPSG:4326`, // WFS 2.0 spec: lat,lng for EPSG:4326
    `${minLng},${minLat},${maxLng},${maxLat},EPSG:4326`, // legacy lng,lat axis order
  ];

  let lastError = 'unknown';
  let data: FeatureCollection | null = null;

  outer: for (const layer of layerCandidates) {
    for (const bbox of bboxCandidates) {
      const params = new URLSearchParams({
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        TYPENAMES: layer,
        OUTPUTFORMAT: 'application/json',
        SRSNAME: 'EPSG:4326',
        BBOX: bbox,
        COUNT: '100',
      });
      const directUrl = `${WFS_BASE}?${params.toString()}`;
      const url = proxyPrefix ? proxyPrefix + encodeURIComponent(directUrl) : directUrl;

      try {
        const res = await fetch(url, { signal: opts.signal });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          // Extract the actual exception text from OWS ExceptionReport XML.
          const exceptionMatch = body.match(/<ows:ExceptionText[^>]*>([^<]+)<\/ows:ExceptionText>/);
          const detail = exceptionMatch?.[1]?.trim()
            || body.replace(/\s+/g, ' ').slice(0, 800).trim()
            || '(kein Body)';
          lastError = `HTTP ${res.status} bei layer="${layer}" — ${detail}`;
          continue;
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('json')) {
          const body = await res.text();
          lastError = `Content-Type=${ct} bei layer="${layer}". Body: ${body.slice(0, 200)}`;
          continue;
        }
        const parsed = (await res.json()) as FeatureCollection;
        if (parsed.features && parsed.features.length > 0) {
          data = parsed;
          break outer;
        }
        lastError = `Layer "${layer}" lieferte keine Features in der BBOX.`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (!data) {
    throw new Error(`NRW WFS lieferte keine nutzbaren Daten. Letzter Fehler: ${lastError}`);
  }
  const features = data.features ?? [];
  if (features.length === 0) {
    throw new Error('NRW WFS: keine Dachflächen in der Umgebung gefunden.');
  }

  return features
    .filter((f): f is Feature<Polygon, NrwFeatureProps> => {
      return f.geometry?.type === 'Polygon';
    })
    .map((f, idx) => {
      const props = (f.properties ?? {}) as NrwFeatureProps;
      const azimuthDeg = num(props.azimuth ?? props.azimut ?? props.ausrichtung ?? props.exposition, 180);
      const pitchDeg = num(props.neigung ?? props.tilt ?? props.pitch ?? props.dachneigung, 30);
      const areaM2 = num(props.geeignete_flaeche_m2 ?? props.flaeche ?? props.area ?? props.nutzbare_flaeche, 0);
      const yieldKwh = num(props.ertrag_kwh ?? props.ertrag ?? props.yearly_kwh ?? props.solarertrag, 0);
      const moduleCount = num(props.module_anzahl ?? props.modulanzahl ?? props.modules, 0);
      const suitability = parseSuitability(props.eignung ?? props.klassifikation ?? props.bewertung);

      return {
        id: typeof f.id === 'string' || typeof f.id === 'number' ? String(f.id) : `nrw_${idx}`,
        polygon: f as Feature<Polygon>,
        azimuthDeg,
        pitchDeg,
        suitability,
        yieldKwh,
        moduleCount,
        areaM2,
      };
    });
}

/**
 * Filter segments to those that belong to the user's building.
 *
 * Strategy:
 *   - If building footprint is given, keep segments whose centroid lies inside
 *     the footprint OR whose polygon overlaps it ≥ 30%.
 *   - Otherwise, keep the segment containing (lat, lng) plus all neighbours
 *     within 8m of its boundary.
 */
export function filterSegmentsForBuilding(
  segments: NrwRoofSegment[],
  building: BuildingFootprint | null,
  fallback: { lat: number; lng: number },
): NrwRoofSegment[] {
  if (segments.length === 0) return [];

  if (building) {
    const buildingPoly = buildingToFeature(building);
    return segments.filter((s) => {
      try {
        const c = turf.centroid(s.polygon);
        return turf.booleanPointInPolygon(c, buildingPoly);
      } catch {
        return false;
      }
    });
  }

  // Fallback: nearest segment + 8m neighbours.
  const point = turf.point([fallback.lng, fallback.lat]);
  let nearest: NrwRoofSegment | null = null;
  let nearestDist = Infinity;
  for (const s of segments) {
    const c = turf.centroid(s.polygon);
    const d = turf.distance(point, c, { units: 'meters' });
    if (d < nearestDist) {
      nearestDist = d;
      nearest = s;
    }
  }
  if (!nearest) return [];
  const nearestCenter = turf.centroid(nearest.polygon);
  return segments.filter((s) => {
    if (s === nearest) return true;
    const c = turf.centroid(s.polygon);
    return turf.distance(nearestCenter, c, { units: 'meters' }) < 8;
  });
}
