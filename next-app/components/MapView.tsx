'use client';

/**
 * Mapbox GL map with 3D buildings + roof polygon + panel grid.
 *
 * Why a thin imperative wrapper: Mapbox GL is imperative by design and React's
 * declarative model fights it. We let the parent pass props and reflect them
 * onto the map via effects.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { Feature, Polygon } from 'geojson';
import type { PanelLayout } from '@/types';

interface Props {
  /** Map centre. Falls back to Borken/NRW until the user picks an address. */
  center: [number, number];
  /** Building footprint to highlight. Null until detected. */
  buildingPolygon: Feature<Polygon> | null;
  /** Currently fitted panels. */
  layout: PanelLayout | null;
  /** Edit mode toggles mapbox-gl-draw on the building polygon. */
  editMode: boolean;
  /** Called whenever the polygon is edited in the UI. */
  onPolygonEdit?(feature: Feature<Polygon>): void;
  /** Bubbles map ref so the parent can take screenshots for PDF export. */
  onReady?(map: mapboxgl.Map): void;
}

const DEFAULT_ZOOM = 13;
const HOUSE_ZOOM = 18;

const SOURCE_BUILDING = 'pv-building-source';
const LAYER_BUILDING_FILL = 'pv-building-fill';
const LAYER_BUILDING_OUTLINE = 'pv-building-outline';
const SOURCE_PANELS = 'pv-panels-source';
const LAYER_PANELS_FILL = 'pv-panels-fill';
const LAYER_PANELS_OUTLINE = 'pv-panels-outline';

export default function MapView({
  center,
  buildingPolygon,
  layout,
  editMode,
  onPolygonEdit,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      // Soft-fail: render a hint instead of crashing the whole page.
      containerRef.current.innerHTML =
        '<div style="padding:24px;color:#7a8393">Mapbox-Token fehlt. Lege ihn in <code>.env.local</code> als <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> ab.</div>';
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: DEFAULT_ZOOM,
      pitch: 45,
      bearing: -10,
      attributionControl: true,
      antialias: true,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.on('style.load', () => {
      // Add Mapbox' built-in 3D buildings layer.
      const layers = map.getStyle().layers ?? [];
      const labelLayer = layers.find(
        (l) => l.type === 'symbol' && (l.layout as Record<string, unknown> | undefined)?.['text-field'],
      );
      const labelLayerId = labelLayer?.id;
      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#dfe3ea',
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'height'],
            ],
            'fill-extrusion-base': [
              'interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'min_height'],
            ],
            'fill-extrusion-opacity': 0.85,
          },
        },
        labelLayerId,
      );

      // Empty sources for our overlays so we can update them later.
      map.addSource(SOURCE_BUILDING, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: LAYER_BUILDING_FILL,
        type: 'fill',
        source: SOURCE_BUILDING,
        paint: { 'fill-color': '#0D73FC', 'fill-opacity': 0.15 },
      });
      map.addLayer({
        id: LAYER_BUILDING_OUTLINE,
        type: 'line',
        source: SOURCE_BUILDING,
        paint: { 'line-color': '#0D73FC', 'line-width': 2.5 },
      });

      map.addSource(SOURCE_PANELS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: LAYER_PANELS_FILL,
        type: 'fill',
        source: SOURCE_PANELS,
        paint: { 'fill-color': '#1e3a8a', 'fill-opacity': 0.85 },
      });
      map.addLayer({
        id: LAYER_PANELS_OUTLINE,
        type: 'line',
        source: SOURCE_PANELS,
        paint: { 'line-color': '#bfdbfe', 'line-width': 0.6 },
      });

      setStyleLoaded(true);
      onReady?.(map);
    });

    return () => {
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // We deliberately want this effect to run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep map centered on the chosen address.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom: HOUSE_ZOOM, pitch: 55, bearing: -10, duration: 1500 });
  }, [center]);

  // Sync building polygon → mapbox source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const src = map.getSource(SOURCE_BUILDING) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      buildingPolygon ?? { type: 'FeatureCollection', features: [] },
    );
  }, [buildingPolygon, styleLoaded]);

  // Sync panels → mapbox source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const src = map.getSource(SOURCE_PANELS) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      layout
        ? { type: 'FeatureCollection', features: layout.panels }
        : { type: 'FeatureCollection', features: [] },
    );
  }, [layout, styleLoaded]);

  // Toggle mapbox-gl-draw for manual polygon editing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    if (editMode && !drawRef.current && buildingPolygon) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'simple_select',
      });
      map.addControl(draw, 'top-left');
      const id = draw.add(buildingPolygon)[0];
      draw.changeMode('direct_select', { featureId: id });

      const handler = () => {
        const fc = draw.getAll();
        const feat = fc.features[0] as Feature<Polygon> | undefined;
        if (feat && feat.geometry.type === 'Polygon') {
          onPolygonEdit?.(feat);
        }
      };
      map.on('draw.update', handler);
      map.on('draw.create', handler);
      drawRef.current = draw;
    }

    if (!editMode && drawRef.current) {
      map.removeControl(drawRef.current);
      drawRef.current = null;
    }
  }, [editMode, styleLoaded, buildingPolygon, onPolygonEdit]);

  return <div ref={containerRef} className="map-view" />;
}
