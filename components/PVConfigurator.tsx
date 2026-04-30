'use client';

/**
 * Top-level orchestrator. Wires the stepper, address search, 3D viewer,
 * sidebar, and lead form together with state in `lib/store.ts`.
 *
 * Effects (kept here so individual components stay presentational):
 *   - On address selection → fetch building footprint + NRW segments + flyTo.
 *   - On segment selection → recompute panel layout for that segment.
 *   - On layout change + address → query PVGIS for accurate yield.
 *   - On any user action → keep `result` in sync (handled in <Sidebar/>).
 */

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as turf from '@turf/turf';
import { useApp } from '@/lib/store';
import { fitPanels, panelsToFeatureCollection } from '@/lib/panel-grid';
import { polygonAreaM2 } from '@/lib/geo';
import type { BuildingFootprint, PanelFeature, PanelLayout } from '@/types';

/**
 * Synthesise a small rectangular footprint around an address point.
 * Used when Overpass finds no OSM building (rural addresses, new builds,
 * incomplete OSM coverage). 12m × 8m is a typical Einfamilienhaus.
 */
function makeFallbackFootprint(lng: number, lat: number): BuildingFootprint {
  const center = turf.point([lng, lat]);
  const halfDiag = Math.sqrt(6 ** 2 + 4 ** 2); // ~7.2m to corner
  const corners = [45, 135, 225, 315].map((bearing) => {
    const dest = turf.destination(center, halfDiag / 1000, bearing, { units: 'kilometers' });
    return [dest.geometry.coordinates[0] as number, dest.geometry.coordinates[1] as number] as [number, number];
  });
  // Close the ring.
  const ring = [corners[0]!, corners[1]!, corners[2]!, corners[3]!, corners[0]!];
  return {
    id: -1,
    coordinates: ring,
  };
}
import AddressSearch from './AddressSearch';
import Stepper from './Stepper';
import Sidebar from './Sidebar';
import LeadForm from './LeadForm';
import ResultBanner from './ResultBanner';
import PdfExportButton from './PdfExportButton';

// Cesium is purely client-side; SSR would explode on `window`.
const CesiumViewer = dynamic(() => import('./CesiumViewer'), { ssr: false, loading: () => <ViewerSkeleton /> });

interface Props {
  /** Marker passed into the lead webhook so A&B can distinguish iframe vs standalone. */
  source?: string;
}

export default function PVConfigurator({ source = 'standalone' }: Props) {
  const step = useApp((s) => s.step);
  const setStep = useApp((s) => s.setStep);
  const nextStep = useApp((s) => s.nextStep);
  const address = useApp((s) => s.address);
  const setAddress = useApp((s) => s.setAddress);
  const setBuilding = useApp((s) => s.setBuilding);
  const setSegments = useApp((s) => s.setSegments);
  const segments = useApp((s) => s.segments);
  const activeSegmentIds = useApp((s) => s.activeSegmentIds);
  const fillAllSuitable = useApp((s) => s.fillAllSuitable);
  const clearSegments = useApp((s) => s.clearSegments);
  const toggleSegment = useApp((s) => s.toggleSegment);
  const setLayout = useApp((s) => s.setLayout);
  const setLoading = useApp((s) => s.setLoading);
  const setYearlyYieldKwh = useApp((s) => s.setYearlyYieldKwh);
  const setError = useApp((s) => s.setError);

  // Address-change pipeline.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      const [lng, lat] = address.center;
      setLoading('building', true);
      setLoading('nrw', true);
      try {
        const [buildingsRes, segmentsRes] = await Promise.all([
          fetch(`/api/buildings?lat=${lat}&lng=${lng}&radius=80`).then((r) => r.json()),
          fetch(`/api/nrw-wfs?lat=${lat}&lng=${lng}`).then((r) => r.json()),
        ]);
        if (cancelled) return;

        if (buildingsRes.error) {
          setError({ title: buildingsRes.error, action: buildingsRes.action, detail: buildingsRes.detail });
          setBuilding(makeFallbackFootprint(lng, lat));
        } else if (buildingsRes.selected) {
          setBuilding(buildingsRes.selected);
        } else {
          // Overpass succeeded but found no building within 80m — synthesize a
          // 12m × 8m rectangle around the address point so the procedural
          // house always has something to render. Better than empty.
          setBuilding(makeFallbackFootprint(lng, lat));
        }

        if (segmentsRes.error) {
          setError({ title: segmentsRes.error, action: segmentsRes.action, detail: segmentsRes.detail });
          setSegments([]);
        } else {
          setSegments(segmentsRes.segments ?? []);
        }

        // Move to roof step automatically.
        if (segmentsRes.segments && segmentsRes.segments.length > 0) {
          setStep('roof');
        }
      } catch (err) {
        setError({
          title: 'Daten konnten nicht geladen werden.',
          action: 'Bitte Internetverbindung prüfen und erneut versuchen.',
          detail: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading('building', false);
        setLoading('nrw', false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, setBuilding, setSegments, setError, setLoading, setStep]);

  // Re-compute panel layout whenever active segments change.
  useEffect(() => {
    if (segments.length === 0 || activeSegmentIds.size === 0) {
      setLayout(null);
      return;
    }
    const merged: PanelFeature[] = [];
    let totalKwp = 0;
    for (const seg of segments) {
      if (!activeSegmentIds.has(seg.id)) continue;
      const layout = fitPanels(seg.polygon, { segmentId: seg.id });
      merged.push(...layout.panels);
      totalKwp += layout.totalKwp;
    }
    const combined: PanelLayout = {
      panels: merged,
      count: merged.length,
      totalKwp: Math.round(totalKwp * 100) / 100,
      panelDimensions: { width: 1.7, height: 1.1 },
      rotationDeg: 0,
    };
    setLayout(combined);
    // Reference panelsToFeatureCollection for tree-shaking sanity.
    void panelsToFeatureCollection(combined.panels);
  }, [segments, activeSegmentIds, setLayout]);

  // PVGIS — fire when we have address + at least one active segment.
  useEffect(() => {
    if (!address || activeSegmentIds.size === 0) {
      setYearlyYieldKwh(0);
      return;
    }
    const activeSegs = segments.filter((s) => activeSegmentIds.has(s.id));
    if (activeSegs.length === 0) return;

    // Use weighted average of tilt/azimuth across active segments.
    let totalArea = 0;
    let weightedTilt = 0;
    let weightedAzimuth = 0;
    let totalKwp = 0;
    for (const seg of activeSegs) {
      const a = polygonAreaM2(seg.polygon);
      totalArea += a;
      weightedTilt += seg.pitchDeg * a;
      weightedAzimuth += seg.azimuthDeg * a;
      // Approx 6 m² per kWp.
      totalKwp += a / 6;
    }
    const tilt = totalArea > 0 ? weightedTilt / totalArea : 30;
    const azimuth = totalArea > 0 ? weightedAzimuth / totalArea : 180;

    let cancelled = false;
    setLoading('pvgis', true);
    fetch(`/api/pvgis?lat=${address.center[1]}&lng=${address.center[0]}&kwp=${totalKwp.toFixed(2)}&tilt=${tilt.toFixed(0)}&azimuth=${azimuth.toFixed(0)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data.yearlyKwh === 'number') {
          setYearlyYieldKwh(data.yearlyKwh);
        }
      })
      .catch(() => {
        // Silent — calculator will use the 950 kWh/kWp fallback.
      })
      .finally(() => setLoading('pvgis', false));
    return () => {
      cancelled = true;
    };
  }, [address, segments, activeSegmentIds, setYearlyYieldKwh, setLoading]);

  const suitableCount = useMemo(
    () => segments.filter((s) => s.suitability === 'sehr gut' || s.suitability === 'gut').length,
    [segments],
  );

  return (
    <div className="configurator">
      <header className="configurator__topbar">
        <div className="configurator__brand">
          <span className="configurator__brand-mark" aria-hidden="true">A&amp;B</span>
          <span>Solarenergy · PV-Konfigurator</span>
        </div>
        <Stepper />
      </header>

      <ResultBanner />

      <main className="configurator__main">
        <section className="configurator__viewer" aria-label="3D-Konfigurator">
          {step === 'address' && !address ? (
            <div className="configurator__landing">
              <h1>In 5 Sekunden Ihre Solaranlage planen.</h1>
              <p>
                Geben Sie Ihre Adresse ein und sehen Sie sofort, was Ihr Dach kann.
                Echte Dachgeometrie aus dem NRW-Solarkataster, kostenlose Berechnung,
                unverbindliches Angebot von A&amp;B Solarenergy.
              </p>
              <AddressSearch onSelect={setAddress} />
            </div>
          ) : (
            <>
              <div className="configurator__searchbar">
                <AddressSearch onSelect={setAddress} initialQuery={address?.placeName ?? ''} />
              </div>
              <CesiumViewer />
              {step === 'roof' && segments.length > 0 && (
                <div className="configurator__roofbar">
                  <div className="configurator__roofbar-info">
                    <strong>{segments.length}</strong> Dachsegmente erkannt
                    {suitableCount > 0 && (
                      <>
                        , davon <strong>{suitableCount}</strong> gut bis sehr gut geeignet
                      </>
                    )}
                    .
                  </div>
                  <div className="configurator__roofbar-actions">
                    <button type="button" className="btn" onClick={fillAllSuitable}>
                      Maximum-Belegung
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={clearSegments}>
                      Zurücksetzen
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={activeSegmentIds.size === 0}
                      onClick={nextStep}
                    >
                      Weiter zur Konfiguration →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <Sidebar />
      </main>

      {step === 'configure' && (
        <section className="configurator__configure" aria-label="Konfiguration">
          <div className="configurator__container">
            <h2>Konfiguration anpassen</h2>
            <p className="muted">
              Anhand Ihres Verbrauchs empfehlen wir die optimale Anlagengröße. Wählen Sie Add-ons,
              um die Wirtschaftlichkeit live zu sehen.
            </p>
            <div className="configurator__configure-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setStep('roof')}>
                ← Zurück
              </button>
              <PdfExportButton />
              <button type="button" className="btn btn--primary" onClick={() => setStep('lead')}>
                Persönliches Angebot →
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 'lead' && (
        <section className="configurator__lead" aria-label="Angebot anfordern">
          <div className="configurator__container">
            <LeadForm source={source} />
            <div className="configurator__lead-back">
              <button type="button" className="btn btn--ghost" onClick={() => setStep('configure')}>
                ← Zurück zur Konfiguration
              </button>
            </div>
          </div>
        </section>
      )}

      <footer className="configurator__footer">
        <span>© A&amp;B Solarenergy · Borken (NRW) · Daten: NRW LANUK Solarkataster, OSM, EU JRC PVGIS</span>
        <span>
          <a href="/privacy" target="_blank" rel="noopener">Datenschutz</a>
        </span>
      </footer>

      {/* Used to lazy-toggle a per-segment via keyboard for accessibility */}
      <div className="visually-hidden" role="region" aria-label="Tastatur-Bedienung Dachsegmente">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleSegment(s.id)}
            tabIndex={-1}
          >
            Segment {s.id} ({s.suitability})
          </button>
        ))}
      </div>
    </div>
  );
}

function ViewerSkeleton() {
  return (
    <div className="cesium-viewer cesium-viewer--skeleton" aria-busy="true" aria-label="3D-Viewer wird geladen">
      <div className="skeleton-shimmer" />
      <span>3D-Viewer wird geladen…</span>
    </div>
  );
}
