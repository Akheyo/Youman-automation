'use client';

/**
 * Top-level orchestrator that wires the sidebar, search and map together.
 *
 * State machine:
 *   idle  → user picks address
 *   loading → fetch /api/buildings
 *   ready  → render polygon + panels in the sidebar and map
 *   error  → show banner; user can retry
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import AddressSearch from './AddressSearch';
import Sidebar from './Sidebar';
import { fitPanels, estimateYearlyKwh } from '@/lib/panel-grid';
import { buildingToFeature, polygonAreaM2 } from '@/lib/geo';
import type { AddressResult, BuildingFootprint, PVResult, RoofOrientation } from '@/types';

// MapView pulls in Mapbox GL which references `window` — load it on the client only.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="map-loading">Karte wird geladen …</div>,
});

const DEFAULT_CENTER: [number, number] = [6.858, 51.844]; // Borken / NRW

export default function PVConfigurator() {
  const [address, setAddress] = useState<AddressResult | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [building, setBuilding] = useState<BuildingFootprint | null>(null);
  const [editedPolygon, setEditedPolygon] = useState<Feature<Polygon> | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<RoofOrientation>({
    tiltDeg: 35,
    azimuthDeg: 180,
  });

  const mapRef = useRef<unknown>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // The polygon currently in use: edited (if user dragged points) else detected.
  const currentPolygon = useMemo<Feature<Polygon> | null>(() => {
    if (editedPolygon) return editedPolygon;
    if (building) return buildingToFeature(building);
    return null;
  }, [editedPolygon, building]);

  // Compute layout + result whenever the polygon or orientation change.
  const result = useMemo<PVResult | null>(() => {
    if (!address || !building || !currentPolygon) return null;
    const layout = fitPanels(currentPolygon);
    const areaM2 = polygonAreaM2(currentPolygon);
    return {
      address,
      building,
      buildingPolygon: currentPolygon,
      areaM2,
      layout,
      orientation,
      estimatedYearlyKwh: estimateYearlyKwh(layout.totalKwp, orientation.tiltDeg, orientation.azimuthDeg),
    };
  }, [address, building, currentPolygon, orientation]);

  // Load building footprint when an address is picked.
  const loadBuilding = useCallback(async (addr: AddressResult) => {
    setLoading(true);
    setError(null);
    setEditedPolygon(null);
    setEditMode(false);
    try {
      const [lng, lat] = addr.center;
      const res = await fetch(`/api/buildings?lat=${lat}&lng=${lng}&radius=80`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.selected) {
        setBuilding(null);
        setError('Kein Gebäude in OSM gefunden. Du kannst manuell ein Polygon zeichnen.');
      } else {
        setBuilding(data.selected as BuildingFootprint);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBuilding(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSelectAddress(addr: AddressResult) {
    setAddress(addr);
    setCenter(addr.center);
    void loadBuilding(addr);
  }

  // PDF export: capture the page and dump it as A4 landscape.
  const handleExportPdf = useCallback(async () => {
    if (!pageRef.current || !result) return;
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const canvas = await html2canvas(pageRef.current, {
      backgroundColor: '#ffffff',
      useCORS: true,
      scale: 2,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
    const safeName = result.address.placeName.replace(/[^\w]+/g, '_').slice(0, 60);
    pdf.save(`pv-${safeName}.pdf`);
  }, [result]);

  // Keep edited polygon valid when address changes.
  useEffect(() => {
    if (!building) setEditedPolygon(null);
  }, [building]);

  return (
    <div className="page" ref={pageRef}>
      <header className="topbar">
        <div className="topbar__brand">A&amp;B Solarenergy · PV-Konfigurator</div>
        <div className="topbar__search">
          <AddressSearch onSelect={handleSelectAddress} />
        </div>
      </header>
      <main className="content">
        <div className="map-wrap">
          <MapView
            center={center}
            buildingPolygon={currentPolygon}
            layout={result?.layout ?? null}
            editMode={editMode}
            onPolygonEdit={(f) => setEditedPolygon(f)}
            onReady={(m) => {
              mapRef.current = m;
            }}
          />
        </div>
        <Sidebar
          result={result}
          loading={loading}
          error={error}
          editMode={editMode}
          onEditToggle={() => setEditMode((v) => !v)}
          orientation={orientation}
          onOrientationChange={setOrientation}
          onExportPdf={handleExportPdf}
        />
      </main>
    </div>
  );
}
