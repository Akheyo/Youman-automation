/**
 * Pixel ↔ Lat/Lng-Umrechnung für ein Mapbox-Static-Image.
 *
 * Mapbox Static Images API rendert Web-Mercator-Tiles. Bei Zoom Z umfasst die
 * Welt 2^Z × 256 Pixel. Wir berechnen die Meter pro Pixel an der Bildmitte
 * und mappen dann linear vom Pixeloffset zurück nach Lat/Lng — exakt genug
 * für ein 600×400-Bild in Hausgröße (<200 m × <200 m).
 *
 * Für Schräglagen am Bildrand bei sehr hohen Breitengraden würde das ungenau,
 * aber für Deutschland (45°-55° N) und Zoom ≥ 18 ist der Fehler < 0.5 m.
 */

const EARTH_CIRCUMFERENCE_M = 40075016.686;

export interface StaticMapView {
  /** Bildmittelpunkt — Längengrad. */
  centerLng: number;
  /** Bildmittelpunkt — Breitengrad. */
  centerLat: number;
  /** Mapbox-Zoom-Stufe (üblich für Hausgröße: 18–20). */
  zoom: number;
  /** Bildbreite in CSS-Pixeln. */
  widthPx: number;
  /** Bildhöhe in CSS-Pixeln. */
  heightPx: number;
}

/** Meter pro Pixel an einem gegebenen Latitude und Zoom-Level. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);
}

/**
 * Bildschirm-Pixel → geographische Koordinaten.
 * Pixel (0,0) ist die linke obere Ecke des Bildes.
 */
export function pixelToLngLat(px: number, py: number, view: StaticMapView): [number, number] {
  const mpp = metersPerPixel(view.centerLat, view.zoom);
  const dx = px - view.widthPx / 2;
  const dy = py - view.heightPx / 2;
  const dLng = (dx * mpp * 360) / (EARTH_CIRCUMFERENCE_M * Math.cos((view.centerLat * Math.PI) / 180));
  const dLat = -(dy * mpp * 360) / EARTH_CIRCUMFERENCE_M;
  return [view.centerLng + dLng, view.centerLat + dLat];
}

/** Geographische Koordinaten → Bildschirm-Pixel. */
export function lngLatToPixel(lng: number, lat: number, view: StaticMapView): [number, number] {
  const mpp = metersPerPixel(view.centerLat, view.zoom);
  const dLng = lng - view.centerLng;
  const dLat = lat - view.centerLat;
  const dx = (dLng * EARTH_CIRCUMFERENCE_M * Math.cos((view.centerLat * Math.PI) / 180)) / 360 / mpp;
  const dy = -(dLat * EARTH_CIRCUMFERENCE_M) / 360 / mpp;
  return [view.widthPx / 2 + dx, view.heightPx / 2 + dy];
}

/**
 * Mapbox Static Images URL — Satellite-Style.
 *
 * Token wird aus `NEXT_PUBLIC_MAPBOX_TOKEN` gelesen. Wenn nicht gesetzt:
 * `null` → Caller zeigt eine Hint-Box.
 */
export function mapboxStaticUrl(view: StaticMapView, token: string): string {
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${view.centerLng.toFixed(6)},${view.centerLat.toFixed(6)},${view.zoom}` +
    `/${view.widthPx}x${view.heightPx}@2x` +
    `?access_token=${encodeURIComponent(token)}&attribution=false&logo=false`
  );
}

/**
 * Geometrie-Auswertung eines vom User gezeichneten Polygons:
 *   - längste Kante → First-Länge
 *   - kürzeste Kante (perpendicular zur längsten) → Hausbreite
 *   - Bearing der längsten Kante → Ausrichtung des Firsts
 *
 * Funktioniert robust für rechteckige bis nahezu rechteckige Footprints.
 */
export interface PolygonDimensions {
  firstLengthM: number;
  houseWidthM: number;
  ridgeBearingDeg: number;
}

export function dimensionsFromPolygon(
  vertices: [number, number][],
): PolygonDimensions | null {
  if (vertices.length < 3) return null;

  // Schließen wenn nicht geschlossen.
  const ring = (() => {
    const first = vertices[0]!;
    const last = vertices[vertices.length - 1]!;
    if (first[0] === last[0] && first[1] === last[1]) return vertices;
    return [...vertices, first] as [number, number][];
  })();

  let longest = 0;
  let longestBearing = 0;
  let shortest = Infinity;

  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const lenM = haversineMeters(a, b);
    const bearing = bearingDeg(a, b);
    if (lenM > longest) {
      longest = lenM;
      longestBearing = bearing;
    }
    if (lenM < shortest) {
      shortest = lenM;
    }
  }
  if (!isFinite(shortest)) shortest = 0;
  return {
    firstLengthM: longest,
    houseWidthM: shortest,
    ridgeBearingDeg: ((longestBearing % 180) + 180) % 180,
  };
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δφ = ((b[1] - a[1]) * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a: [number, number], b: [number, number]): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
