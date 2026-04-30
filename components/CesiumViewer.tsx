'use client';

/**
 * Cesium-based 3D viewer for the PV configurator.
 *
 * Behaviour by config:
 *   - NEXT_PUBLIC_LOD2_TILESET_URL set → load real LoD2 buildings (production).
 *   - NEXT_PUBLIC_LOD2_TILESET_URL empty → terrain + 2.5D solar segments,
 *     with an actionable banner pointing the operator at the conversion
 *     pipeline. NEVER load OSM Buildings as a "looks like 3D" fake.
 *
 * Solar cadastre polygons are added as ground-projected primitives coloured
 * by suitability ("sehr gut" green, "gut" yellow-green, "bedingt" amber,
 * "ungeeignet" grey). Click a segment → toggle in store.
 *
 * The Cesium runtime is loaded dynamically on the client (it ships ~3 MB of
 * JS + workers + assets) so SSR is unaffected.
 */

import { useEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import { useApp } from '@/lib/store';
import { getLod2Config, regierungsbezirkFor } from '@/lib/lod2';
import { buildProceduralHouse } from '@/lib/procedural-house';
import type { NrwRoofSegment } from '@/types';

const SUITABILITY_COLOR: Record<NrwRoofSegment['suitability'], string> = {
  'sehr gut': '#22c55e',
  gut: '#84cc16',
  bedingt: '#f59e0b',
  ungeeignet: '#94a3b8',
};

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
    Cesium?: CesiumModule;
  }
}

interface CesiumModule {
  Ion: { defaultAccessToken: string };
  Viewer: new (container: HTMLElement, options: Record<string, unknown>) => CesiumViewerInstance;
  Cartesian3: {
    fromDegrees: (lng: number, lat: number, height?: number) => unknown;
    fromDegreesArray: (coords: number[]) => unknown[];
    fromDegreesArrayHeights: (coords: number[]) => unknown[];
  };
  Cesium3DTileset: { fromUrl: (url: string, options?: Record<string, unknown>) => Promise<unknown> };
  HeadingPitchRange: new (heading: number, pitch: number, range: number) => unknown;
  Math: { toRadians: (deg: number) => number };
  Color: {
    fromCssColorString: (s: string) => { withAlpha: (a: number) => unknown };
    GREEN: { withAlpha: (a: number) => unknown };
    YELLOW: { withAlpha: (a: number) => unknown };
  };
  PolygonHierarchy: new (positions: unknown[]) => unknown;
  ScreenSpaceEventHandler: new (canvas: HTMLCanvasElement) => {
    setInputAction: (cb: (movement: { position: { x: number; y: number } }) => void, type: number) => void;
    destroy: () => void;
  };
  ScreenSpaceEventType: { LEFT_CLICK: number };
  createWorldTerrainAsync: () => Promise<unknown>;
  createOsmBuildingsAsync: () => Promise<unknown>;
}

interface CesiumViewerInstance {
  scene: {
    primitives: { add: (p: unknown) => unknown; remove: (p: unknown) => boolean };
    globe: { enableLighting: boolean; depthTestAgainstTerrain: boolean };
    skyAtmosphere: { show: boolean };
  };
  entities: {
    add: (e: Record<string, unknown>) => { id: string };
    removeAll: () => void;
    removeById: (id: string) => boolean;
    getById: (id: string) => unknown;
    values: { id: string }[];
  };
  camera: { flyTo: (opts: Record<string, unknown>) => void };
  destroy: () => void;
  isDestroyed: () => boolean;
  canvas: HTMLCanvasElement;
}

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewerInstance | null>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootReady, setBootReady] = useState(false);

  const address = useApp((s) => s.address);
  const segments = useApp((s) => s.segments);
  const activeSegmentIds = useApp((s) => s.activeSegmentIds);
  const toggleSegment = useApp((s) => s.toggleSegment);
  const layout = useApp((s) => s.layout);
  const building = useApp((s) => s.building);

  const lod2 = getLod2Config();
  const region = address ? regierungsbezirkFor(address.center[1], address.center[0]) : null;

  // Boot Cesium once.
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;

    // CESIUM_BASE_URL is set in app/layout.tsx before the script loads.
    if (typeof window !== 'undefined' && !window.CESIUM_BASE_URL) {
      window.CESIUM_BASE_URL = '/cesium';
    }

    (async () => {
      try {
        // Cesium is loaded globally via the <Script> tag in app/layout.tsx
        // (Build/Cesium is shipped as static assets under /cesium). We poll
        // briefly in case beforeInteractive hasn't finished yet — the
        // boot is fast enough that this rarely loops more than once.
        let tries = 0;
        while (!window.Cesium && tries < 60) {
          await new Promise((r) => setTimeout(r, 50));
          tries++;
        }
        const Cesium = window.Cesium;
        if (!Cesium) {
          throw new Error('Cesium konnte nicht geladen werden (timeout). /cesium/Cesium.js erreichbar?');
        }
        if (cancelled || !containerRef.current) return;

        const ionToken = process.env['NEXT_PUBLIC_CESIUM_ION_TOKEN'];
        if (ionToken && ionToken.length > 10) {
          Cesium.Ion.defaultAccessToken = ionToken;
        }

        const terrainProvider = await Cesium.createWorldTerrainAsync();
        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider,
          baseLayerPicker: false,
          timeline: false,
          animation: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // Click handler — use the runtime viewer.scene.pick.
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction((movement) => {
          const sceneWithPick = (viewer as unknown as { scene: { pick: (p: unknown) => unknown } }).scene;
          const picked = sceneWithPick.pick(movement.position);
          const pickedId = (picked as { id?: { id?: string } } | undefined)?.id?.id;
          if (pickedId && pickedId.startsWith('seg_')) {
            toggleSegment(pickedId.slice(4));
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        viewerRef.current = viewer;
        cesiumRef.current = Cesium;
        setBootReady(true);
      } catch (err) {
        setBootError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [toggleSegment]);

  // Load LoD2 tileset (production path) once Cesium is ready and URL is configured.
  // Falls back to OSM Buildings (next effect) if the URL is empty.
  useEffect(() => {
    if (!bootReady || !lod2.url || !cesiumRef.current || !viewerRef.current) return;
    let cancelled = false;
    let tileset: unknown = null;
    (async () => {
      try {
        const Cesium = cesiumRef.current!;
        tileset = await Cesium.Cesium3DTileset.fromUrl(lod2.url!, {
          maximumScreenSpaceError: 12,
          dynamicScreenSpaceError: true,
          dynamicScreenSpaceErrorDensity: 0.00278,
          dynamicScreenSpaceErrorFactor: 4,
        });
        if (cancelled || !viewerRef.current) return;
        viewerRef.current.scene.primitives.add(tileset);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[Cesium] LoD2 tileset failed to load:', err);
      }
    })();
    return () => {
      cancelled = true;
      if (tileset && viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.scene.primitives.remove(tileset);
      }
    };
  }, [bootReady, lod2.url]);

  // Interim 3D context: Cesium OSM Buildings rendered as translucent blue
  // boxes — provides "sea of houses" surrounding the user's procedural house.
  // The user's actual house is then rendered ON TOP via the procedural-house
  // pipeline below, with a real saddle roof and orange tile material.
  useEffect(() => {
    if (!bootReady || lod2.url || !cesiumRef.current || !viewerRef.current) return;
    let cancelled = false;
    let osmBuildings: { style?: unknown } | null = null;
    (async () => {
      try {
        const Cesium = cesiumRef.current as unknown as {
          createOsmBuildingsAsync: () => Promise<{ style?: unknown }>;
          Cesium3DTileStyle: new (def: Record<string, unknown>) => unknown;
        };
        osmBuildings = await Cesium.createOsmBuildingsAsync();
        if (cancelled || !viewerRef.current || !osmBuildings) return;
        // Tint every OSM building translucent blue — they are *context*, not
        // the focus. The user's procedural house sits on top in full colour.
        osmBuildings.style = new Cesium.Cesium3DTileStyle({
          color: "color('#a3c4e8', 0.45)",
        });
        viewerRef.current.scene.primitives.add(osmBuildings);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[Cesium] OSM Buildings konnten nicht laden (Cesium-Ion-Token prüfen):', err);
      }
    })();
    return () => {
      cancelled = true;
      if (osmBuildings && viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.scene.primitives.remove(osmBuildings);
      }
    };
  }, [bootReady, lod2.url]);

  // Fly camera to address. Oblique perspective so the OSM/LoD2 buildings
  // are visible as 3D mass, not from above.
  useEffect(() => {
    if (!bootReady || !address || !cesiumRef.current || !viewerRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const [lng, lat] = address.center;

    // Closer-in oblique framing — close enough that the user's specific house
    // dominates the frame. ~90m offset south, 65m altitude, -35° pitch.
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat - 0.0008, 65),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 1.4,
    });
  }, [bootReady, address]);

  // Render NRW segments as classification polygons.
  useEffect(() => {
    if (!bootReady || !cesiumRef.current || !viewerRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    // Clear and re-render every entity. Cheap at this scale (<200 polygons).
    viewer.entities.removeAll();

    // Address marker — pin at the geocoded point so the user can verify the
    // location actually matches their house, not the neighbour's.
    if (address) {
      viewer.entities.add({
        id: `addr_${address.id}`,
        position: Cesium.Cartesian3.fromDegrees(address.center[0], address.center[1], 50),
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#0D73FC').withAlpha(0.95),
          outlineColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(1),
          outlineWidth: 2,
          heightReference: 1, // CLAMP_TO_GROUND
        } as Record<string, unknown>,
      });
    }

    // Procedural 3D house — extruded walls + saddle roof — for the user's
    // selected OSM building. Pitch + ridge bearing come from the NRW cadastre
    // when available (best fit), else fall back to 35° / longest-edge.
    if (building && building.coordinates && building.coordinates.length >= 4) {
      // Pick the dominant tilt + azimuth from the NRW segments belonging to
      // this building (largest-area segment wins). Default 40° matches typical
      // NRW Satteldach when no cadastre data is available.
      let pitchDeg = 40;
      let ridgeBearing: number | undefined;
      if (segments.length > 0) {
        let maxArea = 0;
        for (const seg of segments) {
          let area = 0;
          try {
            area = turf.area(seg.polygon);
          } catch {
            area = 0;
          }
          if (area > maxArea) {
            maxArea = area;
            pitchDeg = seg.pitchDeg || 40;
            // azimuth (0=N) of segment normal → ridge runs perpendicular to it
            ridgeBearing = (seg.azimuthDeg + 90) % 180;
          }
        }
      }

      const house = buildProceduralHouse({
        footprint: building.coordinates as [number, number][],
        eaveHeightM: building.height && building.height > 3 ? Math.min(building.height - 1, 9) : 6,
        pitchDeg,
        ridgeBearingDeg: ridgeBearing,
      });

      // Render ONLY the roof slopes — walls and gables would hide the
      // photorealistic 3D context (Cesium PRT / OSM Buildings) underneath.
      // The orange roof acts as a "PV planning surface" overlay on top of
      // the real house — same approach envolta uses.
      house.roofSlopes.forEach((part, idx) => {
        const flat = part.positions.flatMap((p) => [p[0], p[1], p[2]]);
        viewer.entities.add({
          id: `house_${building.id}_roof_${idx}`,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArrayHeights(flat)),
            perPositionHeight: true,
            material: Cesium.Color.fromCssColorString('#ff6b00').withAlpha(0.92),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#7a2900').withAlpha(0.95),
          } as Record<string, unknown>,
        });
      });
    }

    // Render the NRW cadastre segments only when we have NO procedural house
    // (no OSM building detected). With a procedural house the roof is shown
    // directly in orange — overlaying segment polygons would clash visually.
    const showSegmentOverlay = !building;
    for (const seg of showSegmentOverlay ? segments : []) {
      const ring = seg.polygon.geometry.coordinates[0];
      if (!ring) continue;
      const positions = ring.flatMap((p) => [p[0] as number, p[1] as number]);
      const isActive = activeSegmentIds.has(seg.id);
      const color = isActive ? '#0D73FC' : SUITABILITY_COLOR[seg.suitability];
      viewer.entities.add({
        id: `seg_${seg.id}`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(positions)),
          material: Cesium.Color.fromCssColorString(color).withAlpha(isActive ? 0.7 : 0.5),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#0D73FC').withAlpha(0.9),
          classificationType: 2,
        } as Record<string, unknown>,
      });
    }

    // Lift solar panels to roof height when we have a procedural house, so
    // they sit visually on top of the orange roof rather than at ground.
    const panelHeight = building && building.coordinates.length >= 4 ? 8 : 0.6;

    if (layout && layout.panels.length > 0) {
      for (const p of layout.panels) {
        const ring = p.geometry.coordinates[0];
        if (!ring) continue;
        // Inject the panel height after every (lng, lat) pair.
        const flat: number[] = [];
        for (const c of ring) {
          flat.push(c[0] as number, c[1] as number, panelHeight);
        }
        viewer.entities.add({
          id: `pan_${p.properties.segmentId}_${p.properties.index}`,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArrayHeights(flat)),
            perPositionHeight: true,
            material: Cesium.Color.fromCssColorString('#0D73FC').withAlpha(0.92),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.95),
          } as Record<string, unknown>,
        });
      }
    }
  }, [bootReady, segments, activeSegmentIds, layout, address, building]);

  return (
    <div className="cesium-viewer">
      <div ref={containerRef} className="cesium-viewer__canvas" aria-label="3D-Visualisierung" />
      {bootError && (
        <div className="cesium-viewer__overlay" role="alert">
          <h4>3D-Viewer konnte nicht starten</h4>
          <p>{bootError}</p>
          <p>
            <strong>Aktion:</strong> NEXT_PUBLIC_CESIUM_ION_TOKEN in <code>.env.local</code> setzen
            (Default-Token von <a href="https://cesium.com/ion" rel="noopener" target="_blank">cesium.com/ion</a>
            ) und Seite neu laden.
          </p>
        </div>
      )}
      {!lod2.configured && bootReady && (
        <div className="cesium-viewer__hint">
          <strong>3D-Vorschau</strong> · OSM-Gebäude (Box-Extrusion) +
          Solarkataster-Polygone.
          {region && (
            <>
              {' '}
              Echte Dachformen (Walmdach, Sattel, Pult&hellip;) sind verfügbar
              sobald das NRW-LoD2-Tileset für Regierungsbezirk{' '}
              <em>{region.label}</em> gehostet ist —{' '}
              <a
                href="https://github.com/akheyo/youman-automation/blob/claude/pv-configurator-3d-XN7Kb/scripts/lod2-pipeline/README.md"
                target="_blank"
                rel="noopener"
              >
                Pipeline-Anleitung
              </a>
              .
            </>
          )}
        </div>
      )}
    </div>
  );
}
