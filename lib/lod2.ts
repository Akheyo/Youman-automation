/**
 * NRW LoD2 Tileset configuration helpers.
 *
 * The tileset URL is read from `NEXT_PUBLIC_LOD2_TILESET_URL`. When unset,
 * the viewer must show an actionable banner pointing the operator at the
 * conversion pipeline in `scripts/lod2-pipeline/`.
 */

export interface Lod2Config {
  /** Configured tileset URL (or null). */
  url: string | null;
  /** Whether the URL is configured at all. */
  configured: boolean;
}

export function getLod2Config(): Lod2Config {
  const url = (process.env.NEXT_PUBLIC_LOD2_TILESET_URL ?? '').trim() || null;
  return { url, configured: url !== null };
}

/**
 * NRW Regierungsbezirke covered by the LANUK Solarkataster + LoD2 program.
 * Used for diagnostic banner: "Tileset für Regierungsbezirk Münster nicht
 * gehostet — folge scripts/lod2-pipeline/README.md."
 */
export const NRW_REGIERUNGSBEZIRKE = [
  { id: 'duesseldorf', label: 'Düsseldorf', bbox: [6.05, 51.05, 7.10, 51.85] },
  { id: 'koeln', label: 'Köln', bbox: [6.07, 50.32, 7.74, 51.20] },
  { id: 'muenster', label: 'Münster', bbox: [6.55, 51.65, 8.20, 52.53] },
  { id: 'detmold', label: 'Detmold', bbox: [8.10, 51.30, 9.46, 52.45] },
  { id: 'arnsberg', label: 'Arnsberg', bbox: [7.10, 50.85, 8.85, 51.85] },
] as const;

export function regierungsbezirkFor(lat: number, lng: number): typeof NRW_REGIERUNGSBEZIRKE[number] | null {
  for (const r of NRW_REGIERUNGSBEZIRKE) {
    const [minLng, minLat, maxLng, maxLat] = r.bbox;
    if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
      return r;
    }
  }
  return null;
}
