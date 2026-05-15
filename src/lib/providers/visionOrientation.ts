/**
 * VisionOrientationProvider
 *
 * Erkennt Hausausrichtung (First-Azimut, Dachflächen-Azimute) aus einem
 * MapTiler-Satellitenbild via Claude Vision API.
 *
 * Pipeline:
 *   1. MapTiler-Static-Map als 768×768-PNG bei Zoom 19 holen → base64.
 *   2. Bild + strukturierter Prompt an Claude (Anthropic Messages API).
 *   3. JSON-Antwort robust parsen (markdown-codefences strippen).
 *   4. Footprint als rotiertes Rechteck um Adress-Center erzeugen.
 *   5. Dachgeometrie über mockRoofs-Builder mit rotationDeg = -ridgeAzimuth.
 *   6. Ergebnis als DetectedBuilding mit source: "vision".
 *
 * Cache: in-memory Map mit 7-Tage-TTL, Key = lat/lng auf 5 Dezimalstellen.
 *
 * Fehler-Fallback:
 *   - ANTHROPIC_API_KEY fehlt    → Provider wird vom Factory nicht aktiviert.
 *   - MapTiler-Key fehlt         → Throw (Chain fällt auf nächsten Provider).
 *   - Anthropic-API HTTP-Fehler  → Throw.
 *   - JSON-Parse-Fehler          → Throw.
 *   - confidence: "low"          → Throw (Fallback auf OSM/Mock).
 */

import type {
  BuildingFootprint,
  DetectedBuilding,
  RoofFace,
} from "@/types/solar";
import { localMetersToLngLat } from "@/lib/geometry/coordinates";
import {
  buildMockRoofFaces,
  type MockBuildingKind,
  type MockBuildingTemplate,
} from "@/lib/geometry/mockRoofs";
import type {
  RoofDetectionInput,
  RoofDetectionProvider,
} from "./roofDetectionProvider";

/* ----------------------------- Konfiguration ----------------------------- */

// Aktuelles Sonnet-Modell mit Vision-Unterstützung. Bei Bedarf auf neuere
// Variante umstellen (z. B. claude-sonnet-4-6) – Aufruf-Signatur bleibt gleich.
const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// MapTiler Static Map: 768×768 (3-Tile-äquivalente Fläche um den Mittelpunkt).
const STATIC_MAP_SIZE = 768;
const STATIC_MAP_ZOOM = 19;

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* ----------------------------- Vision-Schema ----------------------------- */

type VisionRoofShape = "gable" | "hip" | "flat" | "shed" | "complex";

type VisionResult = {
  ridgeAzimuth: number;
  roofFaces: Array<{ azimuth: number; estimatedAreaM2: number }>;
  footprintMeters: { length: number; width: number };
  roofShape: VisionRoofShape;
  confidence: "high" | "medium" | "low";
  notes: string;
};

const VISION_PROMPT = `Du siehst ein Satellitenbild. Nord ist oben (0°), Ost rechts (90°), Süd unten (180°), West links (270°).

Identifiziere das zentrale Hauptgebäude im Bild. Bestimme:
1. Die Ausrichtung des Dachfirsts in Grad (Richtung, in die der First zeigt)
2. Die Ausrichtung jeder erkennbaren Dachfläche in Grad (Richtung, in die die Dachfläche schaut – nicht der First)
3. Die ungefähren Grundriss-Maße in Metern (Länge × Breite, basierend auf typischer Tile-Auflösung bei Zoom 19: ~0.3 m/pixel)
4. Dachform: 'gable' (Satteldach), 'hip' (Walmdach), 'flat' (Flachdach), 'shed' (Pultdach), 'complex'

Antwort ausschließlich als JSON, ohne Markdown-Codefences, ohne Erklärtext:
{
  "ridgeAzimuth": number,
  "roofFaces": [{"azimuth": number, "estimatedAreaM2": number}],
  "footprintMeters": {"length": number, "width": number},
  "roofShape": "gable"|"hip"|"flat"|"shed"|"complex",
  "confidence": "high"|"medium"|"low",
  "notes": "kurze Begründung"
}`;

/* ----------------------------- Cache (in-memory) ----------------------------- */

type CacheEntry = { data: DetectedBuilding; timestamp: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function getCached(key: string): DetectedBuilding | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/* ----------------------------- Provider ----------------------------- */

export class VisionOrientationProvider implements RoofDetectionProvider {
  readonly name = "vision";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("VisionOrientationProvider: ANTHROPIC_API_KEY fehlt.");
    }
  }

  async detectRoof(input: RoofDetectionInput): Promise<DetectedBuilding> {
    const key = cacheKey(input.lat, input.lng);
    const cached = getCached(key);
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(`[vision] cache hit für ${key}`);
      return cached;
    }
    // eslint-disable-next-line no-console
    console.log(`[vision] analysiere Satellitenbild für ${key} …`);

    const mapTilerKey = getMapTilerKey();
    if (!mapTilerKey) {
      throw new Error(
        "MapTiler-Key nicht gefunden (MAPTILER_API_KEY oder Schlüssel in NEXT_PUBLIC_TILE_URL setzen).",
      );
    }

    const base64Image = await fetchSatelliteImage(
      input.lat,
      input.lng,
      mapTilerKey,
    );

    const visionResult = await callClaudeVision(base64Image, this.apiKey);

    if (visionResult.confidence === "low") {
      throw new Error(
        `Vision-Analyse mit niedriger Konfidenz: ${visionResult.notes}`,
      );
    }

    const building = mapVisionToBuilding(visionResult, input);
    cache.set(key, { data: building, timestamp: Date.now() });
    return building;
  }
}

/* ----------------------------- Static-Map-Fetch ----------------------------- */

function getMapTilerKey(): string | null {
  if (process.env.MAPTILER_API_KEY) return process.env.MAPTILER_API_KEY;
  const url = process.env.NEXT_PUBLIC_TILE_URL ?? "";
  const m = url.match(/[?&]key=([^&]+)/);
  return m ? m[1]! : null;
}

async function fetchSatelliteImage(
  lat: number,
  lng: number,
  mapTilerKey: string,
): Promise<string> {
  // MapTiler Static Map API:
  // https://docs.maptiler.com/cloud/api/static-maps/
  const url =
    `https://api.maptiler.com/maps/hybrid/static/${lng},${lat},${STATIC_MAP_ZOOM}/` +
    `${STATIC_MAP_SIZE}x${STATIC_MAP_SIZE}.png?key=${mapTilerKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `MapTiler Static Map HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString("base64");
}

/* ----------------------------- Claude Vision Call ----------------------------- */

async function callClaudeVision(
  base64Image: string,
  apiKey: string,
): Promise<VisionResult> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Image,
              },
            },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Anthropic API HTTP ${res.status}: ${body.slice(0, 300)}`,
    );
  }

  type AnthropicResponse = {
    content?: Array<{ type: string; text?: string }>;
  };
  const data = (await res.json()) as AnthropicResponse;
  const textBlock = (data.content ?? []).find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("Anthropic-API: keine Text-Antwort.");
  }

  // Markdown-Codefences strippen, falls trotz Anweisung gesetzt.
  let jsonText = textBlock.text.trim();
  const fenceMatch = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
  if (fenceMatch && fenceMatch[1]) jsonText = fenceMatch[1].trim();

  try {
    return JSON.parse(jsonText) as VisionResult;
  } catch {
    throw new Error(
      `Vision-Antwort konnte nicht als JSON geparst werden: ${jsonText.slice(0, 200)}`,
    );
  }
}

/* ----------------------------- Mapping → DetectedBuilding ----------------------------- */

const SHAPE_TO_MOCK: Record<VisionRoofShape, MockBuildingKind> = {
  gable: "satteldach",
  hip: "walmdach",
  flat: "flachdach",
  shed: "pultdach",
  complex: "satteldach", // Fallback: Sattel ist die häufigste Form
};

const CONFIDENCE_TO_NUMERIC: Record<"high" | "medium" | "low", number> = {
  high: 0.8,
  medium: 0.65,
  low: 0.4,
};

function mapVisionToBuilding(
  vision: VisionResult,
  input: RoofDetectionInput,
): DetectedBuilding {
  const kind = SHAPE_TO_MOCK[vision.roofShape] ?? "satteldach";

  // Footprint-Dimensionen aus Vision; minimaler Sanity-Check (kein
  // 0-Meter-Haus, kein Riesengebäude).
  const lengthM = clamp(vision.footprintMeters.length, 4, 80);
  const widthM = clamp(vision.footprintMeters.width, 3, 50);
  const halfLengthM = lengthM / 2;
  const halfWidthM = widthM / 2;

  // Default-Höhe + Pitch (Vision liefert die nicht). Pitch 35°, Eave 5,5 m.
  const eaveHeightM = 5.5;
  const pitchDeg = 35;
  const rise = halfWidthM * Math.tan((pitchDeg * Math.PI) / 180);
  const ridgeHeightM = kind === "flachdach" ? eaveHeightM : eaveHeightM + rise;

  // Mock-Builder erwartet rotationDeg als CCW-Rotation (Default-First entlang Y).
  // Vision liefert ridgeAzimuth (CW von N). rotationDeg = -ridgeAzimuth.
  const rotationDeg = -vision.ridgeAzimuth;

  const template: MockBuildingTemplate = {
    kind,
    label: input.address ?? "Vision-Erkennung",
    halfLengthM,
    halfWidthM,
    eaveHeightM,
    ridgeHeightM,
    rotationDeg,
  };
  if (kind === "walmdach") {
    template.ridgeLengthM = lengthM * 0.6;
  }

  const rawRoofFaces = buildMockRoofFaces(template);
  const confidence = CONFIDENCE_TO_NUMERIC[vision.confidence];

  const roofFaces: RoofFace[] = rawRoofFaces.map((f) => ({
    ...f,
    source: "vision",
    confidence,
    metadata: {
      ...f.metadata,
      visionConfidence: vision.confidence,
      visionNotes: vision.notes,
      detectedShape: vision.roofShape,
      ridgeAzimuthDeg: vision.ridgeAzimuth,
      approximation: true,
    },
  }));

  const footprint = buildRotatedRectFootprint(
    input.lat,
    input.lng,
    lengthM,
    widthM,
    vision.ridgeAzimuth,
  );

  const totalRoofAreaM2 = roofFaces.reduce((s, f) => s + f.areaM2, 0);
  const selectedRoofAreaM2 = roofFaces
    .filter((f) => f.selected)
    .reduce((s, f) => s + f.areaM2, 0);

  return {
    buildingId: `vision-${Date.now()}`,
    address: input.address,
    center: { lng: input.lng, lat: input.lat },
    footprint,
    roofFaces,
    modules: [],
    source: "vision",
    confidence,
    metrics: {
      totalRoofAreaM2,
      selectedRoofAreaM2,
      moduleCount: 0,
      totalKwp: 0,
    },
    warnings: [
      `KI-Analyse Satellitenbild via Claude (Konfidenz: ${vision.confidence}).`,
      `Geschätzte Maße: ${lengthM.toFixed(0)} × ${widthM.toFixed(0)} m, First-Azimut ${vision.ridgeAzimuth.toFixed(0)}°.`,
      `Hinweis: ${vision.notes}`,
    ],
  };
}

/** Rotiertes Rechteck als Footprint um (centerLng, centerLat). */
function buildRotatedRectFootprint(
  centerLat: number,
  centerLng: number,
  lengthM: number,
  widthM: number,
  azimuthDeg: number,
): BuildingFootprint {
  const halfL = lengthM / 2;
  const halfW = widthM / 2;
  // Default-Rechteck: Länge entlang Y (Nord), Breite entlang X (Ost).
  const corners = [
    { x: -halfW, y: -halfL },
    { x: halfW, y: -halfL },
    { x: halfW, y: halfL },
    { x: -halfW, y: halfL },
  ];
  // CW-Rotation um azimuth (X=East, Y=North).
  const rad = (azimuthDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotated = corners.map((c) => ({
    x: c.x * cos + c.y * sin,
    y: -c.x * sin + c.y * cos,
  }));
  return {
    vertices: rotated.map((c) =>
      localMetersToLngLat(c.x, c.y, centerLng, centerLat),
    ),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
