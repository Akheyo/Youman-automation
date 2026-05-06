/**
 * Minimaler Overpass-API-Client.
 *
 * Holt Gebäude-Geometrien aus OpenStreetMap rund um eine lat/lng-Position.
 * Kein API-Key, kein Auth – Overpass ist frei nutzbar (mit Rate-Limits, die
 * für einzelne Adressabfragen kein Problem sind).
 *
 * Mehrere Spiegel sind verfügbar; wir versuchen den Hauptserver zuerst und
 * fallen ggf. auf einen Spiegel zurück. Tiefe Caching-Strategien überlassen
 * wir der Anwendung – für den Prototyp reicht ein direkter Call.
 */

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

export type OsmTags = Record<string, string>;

export type OsmBuilding = {
  id: number;
  /** Geschlossene Polyline in (lat, lng). */
  geometry: { lat: number; lng: number }[];
  tags: OsmTags;
};

export async function fetchBuildingsNear(
  lat: number,
  lng: number,
  radiusM = 40,
): Promise<OsmBuilding[]> {
  // Wichtig: nur ways mit `building`-Tag, mit Geometrie. Multipolygone
  // (relations) lassen wir hier weg – komplexer zu parsen, für den Prototyp
  // genügen Standard-Building-Polygone.
  const query = `[out:json][timeout:15];
(
  way["building"](around:${radiusM},${lat},${lng});
);
out body geom tags;`;

  const body = `data=${encodeURIComponent(query)}`;

  let lastError: unknown = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        lastError = new Error(`Overpass HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      const elements = data.elements ?? [];
      const buildings: OsmBuilding[] = [];
      for (const el of elements) {
        if (el.type !== "way") continue;
        if (!Array.isArray(el.geometry) || el.geometry.length < 3) continue;
        buildings.push({
          id: el.id,
          geometry: el.geometry.map((g) => ({ lat: g.lat, lng: g.lon })),
          tags: el.tags ?? {},
        });
      }
      return buildings;
    } catch (err) {
      lastError = err;
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : "Unbekannter Overpass-Fehler";
  throw new Error(`OSM Overpass nicht erreichbar: ${message}`);
}

type OverpassElement = {
  type: string;
  id: number;
  geometry?: { lat: number; lon: number }[];
  tags?: OsmTags;
};
