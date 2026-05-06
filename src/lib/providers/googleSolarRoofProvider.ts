/**
 * GoogleSolarRoofProvider
 *
 * Ruft die Google Solar API (`buildingInsights:findClosest`) auf und
 * normalisiert das Ergebnis in unser einheitliches `DetectedBuilding`.
 *
 * Wichtig:
 * - Die Google Solar API liefert KEINE echten Polygon-Eckpunkte der
 *   Dachflächen, sondern Statistiken (Neigung, Azimuth, Fläche, Bounding-Box,
 *   `planeHeightAtCenterMeters`, Segment-Center).
 * - Wir konstruieren daraus approximierte Quadrilaterale ("tilted rectangles").
 *   Diese sind gut für die 3D-Visualisierung und Modulplatzierung, aber
 *   keine amtlich vermessenen Dachformen.
 * - Sobald LoD2-Daten verfügbar sind, ersetzt der Lod2RoofProvider die
 *   Geometrie durch echte Polygone.
 *
 * Approximationen sind im `metadata.approximation = true` markiert und
 * reduzieren die `confidence` der entsprechenden RoofFace.
 */

import type {
  BuildingFootprint,
  DetectedBuilding,
  PVModule,
  RoofFace,
  Vec3,
} from "@/types/solar";
import { lngLatToLocalMeters } from "@/lib/geometry/coordinates";
import { polygonArea3D } from "@/lib/geometry/roofMath";
import type {
  RoofDetectionInput,
  RoofDetectionProvider,
} from "./roofDetectionProvider";

/* ----------------------------- API Response ----------------------------- */

type LatLng = { latitude: number; longitude: number };

type LatLngBox = { sw: LatLng; ne: LatLng };

type SegmentStat = {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  stats?: { areaMeters2?: number; groundAreaMeters2?: number };
  center?: LatLng;
  boundingBox?: LatLngBox;
  planeHeightAtCenterMeters?: number;
};

type SolarPanel = {
  center?: LatLng;
  orientation?: "LANDSCAPE" | "PORTRAIT";
  yearlyEnergyDcKwh?: number;
  segmentIndex?: number;
};

type BuildingInsightsResponse = {
  name?: string;
  center?: LatLng;
  boundingBox?: LatLngBox;
  imageryQuality?: "HIGH" | "MEDIUM" | "LOW";
  solarPotential?: {
    maxArrayPanelsCount?: number;
    panelCapacityWatts?: number;
    panelHeightMeters?: number;
    panelWidthMeters?: number;
    wholeRoofStats?: { areaMeters2?: number };
    roofSegmentStats?: SegmentStat[];
    solarPanels?: SolarPanel[];
    solarPanelConfigs?: Array<{ panelsCount: number }>;
  };
  error?: { code?: number; message?: string; status?: string };
};

/* ----------------------------- Helpers ----------------------------- */

const DEG = Math.PI / 180;

function azimuthToWorldVectors(azimuthDeg: number) {
  // u_local = downhill direction (in XY plane)
  // v_local = ridge direction (perpendicular)
  const r = azimuthDeg * DEG;
  return {
    u: { x: Math.sin(r), y: Math.cos(r) },
    v: { x: Math.cos(r), y: -Math.sin(r) },
  };
}

/**
 * Erzeugt ein approximiertes 4-Punkt-Polygon einer Dachfläche aus
 * (pitch, azimuth, area, center, planeHeightAtCenter).
 *
 * Geometrie-Konvention:
 *   - Lokales (u, v)-System: u = downhill (Azimuth-Richtung), v = First-Linie.
 *   - Höhenunterschied zwischen Traufe und First = W_slope * sin(pitch).
 *   - Eave-Seite ist im Plus-u-Halbraum, Ridge-Seite im Minus-u-Halbraum.
 *   - planeHeightAtCenterMeters = Z am Mittelpunkt der Fläche.
 *   - Vertices in CCW-Reihenfolge von oben gesehen → Normale zeigt nach oben.
 */
function approximateRoofFaceVertices(args: {
  centerLocal: { x: number; y: number };
  pitchDeg: number;
  azimuthDeg: number;
  areaM2: number;
  planeHeightM: number;
  aspectRatio: number; // L : W_slope
}): Vec3[] {
  const { centerLocal, pitchDeg, azimuthDeg, areaM2, planeHeightM } = args;
  const aspect = Math.max(0.5, args.aspectRatio);
  const wSlope = Math.sqrt(areaM2 / aspect);
  const ridgeLen = aspect * wSlope;
  const wHoriz = wSlope * Math.cos(pitchDeg * DEG);
  const heightDelta = wSlope * Math.sin(pitchDeg * DEG);
  const ridgeZ = planeHeightM + heightDelta / 2;
  const eaveZ = planeHeightM - heightDelta / 2;

  const { u, v } = azimuthToWorldVectors(azimuthDeg);
  const halfW = wHoriz / 2;
  const halfL = ridgeLen / 2;

  // Lokal: ridge bei u = -halfW, eave bei u = +halfW.
  // CCW (von oben): ridge-SW → eave-SE → eave-NE → ridge-NW
  //   wobei "S" hier die -v-Seite und "N" die +v-Seite meint.
  const local: { lu: number; lv: number; lz: number }[] = [
    { lu: -halfW, lv: -halfL, lz: ridgeZ },
    { lu: +halfW, lv: -halfL, lz: eaveZ },
    { lu: +halfW, lv: +halfL, lz: eaveZ },
    { lu: -halfW, lv: +halfL, lz: ridgeZ },
  ];

  return local.map((p) => ({
    x: centerLocal.x + p.lu * u.x + p.lv * v.x,
    y: centerLocal.y + p.lu * u.y + p.lv * v.y,
    z: p.lz,
  }));
}

/**
 * Baut ein PV-Modul-Rechteck (4 Vertices) das auf der gleichen Ebene wie
 * eine Dachfläche liegt.
 */
function panelRectVertices(args: {
  centerLocal: { x: number; y: number };
  pitchDeg: number;
  azimuthDeg: number;
  widthM: number; // entlang ridge
  heightM: number; // entlang slope
  segmentCenterLocal: { x: number; y: number };
  segmentPlaneHeightM: number;
}): Vec3[] {
  const { centerLocal, pitchDeg, azimuthDeg, widthM, heightM } = args;
  const { u, v } = azimuthToWorldVectors(azimuthDeg);

  // Z auf der Ebene: z(x,y) = z0 - (n_x*(x-cx)+n_y*(y-cy))/n_z
  const nx = Math.sin(azimuthDeg * DEG) * Math.sin(pitchDeg * DEG);
  const ny = Math.cos(azimuthDeg * DEG) * Math.sin(pitchDeg * DEG);
  const nz = Math.cos(pitchDeg * DEG);
  const zOnPlane = (x: number, y: number) =>
    args.segmentPlaneHeightM -
    (nx * (x - args.segmentCenterLocal.x) +
      ny * (y - args.segmentCenterLocal.y)) /
      Math.max(nz, 1e-6);

  const halfW = widthM / 2;
  const halfH = (heightM * Math.cos(pitchDeg * DEG)) / 2;
  // Modul horizontal um centerLocal aufspannen (kleine Z-Korrektur via Plane).
  const corners2D = [
    { lu: -halfH, lv: -halfW },
    { lu: +halfH, lv: -halfW },
    { lu: +halfH, lv: +halfW },
    { lu: -halfH, lv: +halfW },
  ];
  return corners2D.map((p) => {
    const wx = centerLocal.x + p.lu * u.x + p.lv * v.x;
    const wy = centerLocal.y + p.lu * u.y + p.lv * v.y;
    return { x: wx, y: wy, z: zOnPlane(wx, wy) + 0.05 /* leicht abheben */ };
  });
}

/* ----------------------------- Provider ----------------------------- */

export class GoogleSolarRoofProvider implements RoofDetectionProvider {
  readonly name = "google-solar";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("GoogleSolarRoofProvider: API key fehlt");
    }
  }

  async detectRoof(input: RoofDetectionInput): Promise<DetectedBuilding> {
    const url = new URL(
      "https://solar.googleapis.com/v1/buildingInsights:findClosest",
    );
    url.searchParams.set("location.latitude", String(input.lat));
    url.searchParams.set("location.longitude", String(input.lng));
    url.searchParams.set("requiredQuality", "HIGH");
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as BuildingInsightsResponse;
      const message =
        body?.error?.message ??
        `Google Solar API Fehler: HTTP ${res.status}`;
      throw new Error(message);
    }

    const data = (await res.json()) as BuildingInsightsResponse;
    const segments = data.solarPotential?.roofSegmentStats ?? [];
    const center = data.center;
    if (!center || segments.length === 0) {
      throw new Error(
        "Google Solar API hat für diesen Standort keine Dachflächen geliefert.",
      );
    }

    const centerLng = center.longitude;
    const centerLat = center.latitude;

    // Footprint aus boundingBox (wenn vorhanden).
    let footprint: BuildingFootprint | undefined;
    if (data.boundingBox) {
      const { sw, ne } = data.boundingBox;
      footprint = {
        vertices: [
          { lng: sw.longitude, lat: sw.latitude },
          { lng: ne.longitude, lat: sw.latitude },
          { lng: ne.longitude, lat: ne.latitude },
          { lng: sw.longitude, lat: ne.latitude },
        ],
      };
    }

    const warnings: string[] = [];
    if (data.imageryQuality && data.imageryQuality !== "HIGH") {
      warnings.push(
        `Google-Bildqualität: ${data.imageryQuality}. Dachgeometrie ist gröber approximiert.`,
      );
    }
    warnings.push(
      "Google Solar API liefert keine echten Polygon-Eckpunkte. Dachflächen wurden als geneigte Rechtecke approximiert (metadata.approximation = true).",
    );

    /* --------- RoofFaces aus roofSegmentStats --------- */
    const roofFaces: RoofFace[] = segments.map((seg, idx) => {
      const pitchDeg = seg.pitchDegrees ?? 0;
      const azimuthDeg = seg.azimuthDegrees ?? 180;
      const areaM2 = seg.stats?.areaMeters2 ?? 20;
      const segCenter = seg.center
        ? lngLatToLocalMeters(
            seg.center.longitude,
            seg.center.latitude,
            centerLng,
            centerLat,
          )
        : { x: 0, y: 0 };

      // Aspect ratio aus Bounding-Box approximieren (sonst 1.5).
      let aspect = 1.5;
      if (seg.boundingBox) {
        const sw = lngLatToLocalMeters(
          seg.boundingBox.sw.longitude,
          seg.boundingBox.sw.latitude,
          centerLng,
          centerLat,
        );
        const ne = lngLatToLocalMeters(
          seg.boundingBox.ne.longitude,
          seg.boundingBox.ne.latitude,
          centerLng,
          centerLat,
        );
        const dx = Math.abs(ne.x - sw.x);
        const dy = Math.abs(ne.y - sw.y);
        const long = Math.max(dx, dy);
        const short = Math.max(0.5, Math.min(dx, dy));
        aspect = Math.min(4, Math.max(0.5, long / short));
      }

      const planeHeightM =
        seg.planeHeightAtCenterMeters ?? 5 + idx * 0.05; // Fallback inkl. minimaler Z-Versatz
      const vertices3d = approximateRoofFaceVertices({
        centerLocal: segCenter,
        pitchDeg,
        azimuthDeg,
        areaM2,
        planeHeightM,
        aspectRatio: aspect,
      });

      // Echte Fläche aus den approximierten Vertices (zur Plausibilisierung).
      const recomputedAreaM2 = polygonArea3D(vertices3d);

      return {
        id: `gs-seg-${idx}`,
        label: `Dachfläche ${idx + 1} (${Math.round(azimuthDeg)}°)`,
        vertices3d,
        centerLngLat: seg.center
          ? { lng: seg.center.longitude, lat: seg.center.latitude }
          : undefined,
        pitchDeg,
        azimuthDeg,
        areaM2: areaM2 || recomputedAreaM2,
        selected: true,
        confidence: 0.6, // approximiert
        source: "google-solar",
        metadata: {
          approximation: true,
          recomputedAreaM2,
          aspectRatio: aspect,
          planeHeightAtCenterMeters: planeHeightM,
          imageryQuality: data.imageryQuality,
        },
      };
    });

    /* --------- Module aus solarPanels (optional, zur Visualisierung) --------- */
    const panels = data.solarPotential?.solarPanels ?? [];
    const panelW = data.solarPotential?.panelWidthMeters ?? 1.045;
    const panelH = data.solarPotential?.panelHeightMeters ?? 1.879;
    const panelWp = data.solarPotential?.panelCapacityWatts ?? 400;

    const modules: PVModule[] = [];
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i]!;
      if (!p.center || p.segmentIndex === undefined) continue;
      const seg = segments[p.segmentIndex];
      if (!seg) continue;
      const segCenter = seg.center
        ? lngLatToLocalMeters(
            seg.center.longitude,
            seg.center.latitude,
            centerLng,
            centerLat,
          )
        : { x: 0, y: 0 };
      const panelCenter = lngLatToLocalMeters(
        p.center.longitude,
        p.center.latitude,
        centerLng,
        centerLat,
      );
      const isPortrait = (p.orientation ?? "PORTRAIT") === "PORTRAIT";
      const widthAlongRidge = isPortrait ? panelW : panelH;
      const heightAlongSlope = isPortrait ? panelH : panelW;

      const verts = panelRectVertices({
        centerLocal: panelCenter,
        pitchDeg: seg.pitchDegrees ?? 0,
        azimuthDeg: seg.azimuthDegrees ?? 180,
        widthM: widthAlongRidge,
        heightM: heightAlongSlope,
        segmentCenterLocal: segCenter,
        segmentPlaneHeightM: seg.planeHeightAtCenterMeters ?? 5,
      });

      modules.push({
        id: `gs-panel-${i}`,
        roofFaceId: `gs-seg-${p.segmentIndex}`,
        vertices3d: verts,
        wp: panelWp,
      });
    }

    const totalRoofAreaM2 = roofFaces.reduce((s, f) => s + f.areaM2, 0);
    const selectedRoofAreaM2 = roofFaces
      .filter((f) => f.selected)
      .reduce((s, f) => s + f.areaM2, 0);

    return {
      buildingId: data.name ?? `google-solar-${Date.now()}`,
      address: input.address,
      center: { lng: centerLng, lat: centerLat },
      footprint,
      roofFaces,
      modules,
      source: "google-solar",
      confidence: data.imageryQuality === "HIGH" ? 0.8 : 0.6,
      metrics: {
        totalRoofAreaM2,
        selectedRoofAreaM2,
        moduleCount: modules.length,
        totalKwp: (modules.length * panelWp) / 1000,
      },
      warnings,
    };
  }
}
