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
import { useApp } from '@/lib/store';
import { getLod2Config, regierungsbezirkFor } from '@/lib/lod2';
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
  Cartesian3: { fromDegrees: (lng: number, lat: number, height?: number) => unknown };
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
}

interface CesiumViewerInstance {
  scene: { primitives: { add: (p: unknown) => unknown }; globe: { enableLighting: boolean } };
  entities: {
    add: (e: Record<string, unknown>) => { id: string };
    removeAll: () => void;
    getById: (id: string) => unknown;
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

  // Load LoD2 tileset once Cesium is ready and URL is configured.
  useEffect(() => {
    if (!bootReady || !lod2.url || !cesiumRef.current || !viewerRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const Cesium = cesiumRef.current!;
        const tileset = await Cesium.Cesium3DTileset.fromUrl(lod2.url!, {
          maximumScreenSpaceError: 12,
          dynamicScreenSpaceError: true,
          dynamicScreenSpaceErrorDensity: 0.00278,
          dynamicScreenSpaceErrorFactor: 4,
        });
        if (cancelled || !viewerRef.current) return;
        viewerRef.current.scene.primitives.add(tileset);
      } catch (err) {
        // Loading failed — surface the actionable message but don't crash the viewer.
        // eslint-disable-next-line no-console
        console.warn('[Cesium] LoD2 tileset failed to load:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootReady, lod2.url]);

  // Fly camera to address and re-render solar segments.
  useEffect(() => {
    if (!bootReady || !address || !cesiumRef.current || !viewerRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const [lng, lat] = address.center;

    viewer.entities.removeAll();
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 220),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-55),
      },
      duration: 1.2,
    });
  }, [bootReady, address]);

  // Render NRW segments as classification polygons.
  useEffect(() => {
    if (!bootReady || !cesiumRef.current || !viewerRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    // Clear segment-only entities (keep panel entities by re-keying).
    viewer.entities.removeAll();

    for (const seg of segments) {
      const ring = seg.polygon.geometry.coordinates[0];
      if (!ring) continue;
      const positions = ring.flatMap((p) => [p[0] as number, p[1] as number]);
      const isActive = activeSegmentIds.has(seg.id);
      const color = isActive ? '#0D73FC' : SUITABILITY_COLOR[seg.suitability];
      viewer.entities.add({
        id: `seg_${seg.id}`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(
            (Cesium.Cartesian3.fromDegrees as unknown as (...a: number[]) => unknown[])(...positions),
          ),
          material: Cesium.Color.fromCssColorString(color).withAlpha(isActive ? 0.65 : 0.45),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#0D73FC').withAlpha(0.9),
          // When LoD2 is hosted, segments classify the building tiles.
          // When not, segments lay on terrain — that's the honest 2.5D fallback.
          classificationType: 2,
          height: lod2.configured ? undefined : 0.5,
        } as Record<string, unknown>,
      });
    }

    if (layout && layout.panels.length > 0) {
      for (const p of layout.panels) {
        const ring = p.geometry.coordinates[0];
        if (!ring) continue;
        const positions = ring.flatMap((c) => [c[0] as number, c[1] as number]);
        viewer.entities.add({
          id: `pan_${p.properties.segmentId}_${p.properties.index}`,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(
              (Cesium.Cartesian3.fromDegrees as unknown as (...a: number[]) => unknown[])(...positions),
            ),
            material: Cesium.Color.fromCssColorString('#0D73FC').withAlpha(0.85),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.95),
            classificationType: 2,
            height: lod2.configured ? undefined : 0.6,
          } as Record<string, unknown>,
        });
      }
    }
  }, [bootReady, segments, activeSegmentIds, layout, lod2.configured]);

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
          <strong>2.5D-Ansicht</strong> · Solarkataster-Polygone auf Gelände-Mesh.
          {region && (
            <>
              {' '}
              LoD2-Tileset für Regierungsbezirk <em>{region.label}</em> noch nicht gehostet —{' '}
              <a
                href="https://github.com/akheyo/youman-automation/blob/claude/pv-configurator-3d-XN7Kb/scripts/lod2-pipeline/README.md"
                target="_blank"
                rel="noopener"
              >
                Pipeline-Anleitung
              </a>{' '}
              ausführen für photorealistische Dachformen.
            </>
          )}
        </div>
      )}
    </div>
  );
}
