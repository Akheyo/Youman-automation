/**
 * Koordinaten-Transformationen zwischen WGS84 (lng/lat) und einem lokalen
 * Meter-Koordinatensystem mit Ursprung im Gebäudezentrum.
 *
 * Lokale Achsen:
 *   X = Ost (positiv) / West (negativ)
 *   Y = Nord (positiv) / Süd (negativ)
 *   Z = Höhe in Metern über Ground
 *
 * Für die kleinen Distanzen eines Einzelgebäudes (< 200 m) ist die
 * Equirectangular-Approximation hinreichend genau.
 */

import type { LngLat, Vec3 } from "@/types/solar";

const METERS_PER_DEG_LAT = 111_320;

export function metersPerDegLng(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

export function lngLatToLocalMeters(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
): { x: number; y: number } {
  const x = (lng - centerLng) * metersPerDegLng(centerLat);
  const y = (lat - centerLat) * METERS_PER_DEG_LAT;
  return { x, y };
}

export function localMetersToLngLat(
  x: number,
  y: number,
  centerLng: number,
  centerLat: number,
): LngLat {
  const lng = centerLng + x / metersPerDegLng(centerLat);
  const lat = centerLat + y / METERS_PER_DEG_LAT;
  return { lng, lat };
}

/** Rotation um den Ursprung in der XY-Ebene. */
export function rotatePoint2D(
  x: number,
  y: number,
  angleDeg: number,
): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Verschiebt einen Vec3 um delta. */
export function translateVec3(v: Vec3, dx: number, dy: number, dz: number): Vec3 {
  return { x: v.x + dx, y: v.y + dy, z: v.z + dz };
}

/** Mittelpunkt einer Liste von Punkten (X/Y/Z). */
export function centroid3D(points: Vec3[]): Vec3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sz += p.z;
  }
  return { x: sx / points.length, y: sy / points.length, z: sz / points.length };
}
