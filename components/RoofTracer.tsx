'use client';

/**
 * 2D-Satellitenbild-Tracer.
 *
 * Lädt ein Mapbox-Satellite-Static-Image um die Adresse herum und legt ein
 * SVG-Overlay drüber: Linksklick fügt einen Vertex hinzu, Doppelklick (oder
 * "Polygon schließen"-Button) schließt das Polygon. Anschließend werden
 * Pixel-Koordinaten via Web-Mercator zurück nach Lat/Lng konvertiert und die
 * Hausmaße daraus abgeleitet:
 *
 *   längste Kante  →  First-Länge
 *   kürzeste Kante →  Haus-Breite
 *
 * Diese Maße fließen in `lib/roof-geometry.ts` ein und werden zur kWp-/Ertrags-
 * Berechnung gemäß Excel-Sheet verwendet.
 */

import { useMemo, useState } from 'react';
import {
  dimensionsFromPolygon,
  lngLatToPixel,
  mapboxStaticUrl,
  pixelToLngLat,
  type StaticMapView,
} from '@/lib/static-map';

interface Props {
  centerLng: number;
  centerLat: number;
  /** Default 19 — passt für ein Einfamilienhaus auf einem 800×600-Bild. */
  zoom?: number;
  width?: number;
  height?: number;
  /** Wird beim "Übernehmen" aufgerufen. */
  onConfirm: (result: TraceResult) => void;
  onCancel?: () => void;
}

export interface TraceResult {
  /** Geschlossener Ring [lng, lat], first === last. */
  ring: [number, number][];
  firstLengthM: number;
  houseWidthM: number;
  ridgeBearingDeg: number;
}

const DEFAULTS = { zoom: 19, width: 800, height: 600 };

export default function RoofTracer({
  centerLng, centerLat,
  zoom = DEFAULTS.zoom,
  width = DEFAULTS.width,
  height = DEFAULTS.height,
  onConfirm, onCancel,
}: Props) {
  const [vertices, setVertices] = useState<[number, number][]>([]); // pixel coords
  const [closed, setClosed] = useState(false);

  const view: StaticMapView = useMemo(
    () => ({ centerLng, centerLat, zoom, widthPx: width, heightPx: height }),
    [centerLng, centerLat, zoom, width, height],
  );

  const token = process.env['NEXT_PUBLIC_MAPBOX_TOKEN'];
  const imgUrl = token ? mapboxStaticUrl(view, token) : null;

  const dimensions = useMemo(() => {
    if (vertices.length < 3) return null;
    const lngLatRing = vertices.map((v) => pixelToLngLat(v[0], v[1], view));
    return dimensionsFromPolygon(lngLatRing);
  }, [vertices, view]);

  function onClickSvg(e: React.MouseEvent<SVGSVGElement>) {
    if (closed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const py = ((e.clientY - rect.top) / rect.height) * height;
    setVertices((prev) => [...prev, [px, py]]);
  }

  function closePolygon() {
    if (vertices.length < 3) return;
    setClosed(true);
  }

  function reset() {
    setVertices([]);
    setClosed(false);
  }

  function confirm() {
    if (!closed || !dimensions) return;
    const lngLatRing = vertices.map((v) => pixelToLngLat(v[0], v[1], view));
    const first = lngLatRing[0]!;
    const closedRing: [number, number][] = [...lngLatRing, first];
    onConfirm({
      ring: closedRing,
      firstLengthM: dimensions.firstLengthM,
      houseWidthM: dimensions.houseWidthM,
      ridgeBearingDeg: dimensions.ridgeBearingDeg,
    });
  }

  // Live edge-lengths — zeigen wir während des Zeichnens an, damit der User
  // sieht ob die Kante gerade ungefähr der Hauswand entspricht.
  const edgeLabels = useMemo(() => {
    const labels: { x: number; y: number; text: string }[] = [];
    const ring = closed && vertices.length >= 3 ? [...vertices, vertices[0]!] : vertices;
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]!;
      const b = ring[i + 1]!;
      const aLngLat = pixelToLngLat(a[0], a[1], view);
      const bLngLat = pixelToLngLat(b[0], b[1], view);
      const dx = bLngLat[0] - aLngLat[0];
      const dy = bLngLat[1] - aLngLat[1];
      const lenM = Math.sqrt(
        (dx * Math.cos((view.centerLat * Math.PI) / 180) * 111320) ** 2 +
        (dy * 110540) ** 2,
      );
      labels.push({
        x: (a[0] + b[0]) / 2,
        y: (a[1] + b[1]) / 2,
        text: `${lenM.toFixed(1)} m`,
      });
    }
    return labels;
  }, [vertices, closed, view]);

  // Center crosshair so the user can verify the address point matches.
  const [centerPx, centerPy] = lngLatToPixel(centerLng, centerLat, view);

  if (!token) {
    return (
      <div className="roof-tracer roof-tracer--noToken">
        <h4>Satellitenbild nicht verfügbar</h4>
        <p>
          Für den 2D-Tracer wird ein Mapbox-Token benötigt
          (<code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>.env.local</code>).
          Alternativ können Sie die Maße manuell eintragen.
        </p>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Zurück
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="roof-tracer">
      <div className="roof-tracer__canvas" style={{ width, height, maxWidth: '100%' }}>
        {imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt="Satellitenbild der Adresse"
            width={width}
            height={height}
            draggable={false}
          />
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onClick={onClickSvg}
          onDoubleClick={closePolygon}
          role="application"
          aria-label="Dach-Polygon zeichnen"
        >
          {/* Crosshair an der Adresse */}
          <g stroke="#0D73FC" strokeWidth={1.5} opacity={0.8}>
            <line x1={centerPx - 8} y1={centerPy} x2={centerPx + 8} y2={centerPy} />
            <line x1={centerPx} y1={centerPy - 8} x2={centerPx} y2={centerPy + 8} />
            <circle cx={centerPx} cy={centerPy} r={3} fill="#0D73FC" />
          </g>

          {/* Polygon-Vorschau */}
          {vertices.length >= 2 && (
            <polyline
              points={vertices.map((v) => `${v[0]},${v[1]}`).join(' ')}
              fill={closed ? 'rgba(255,107,0,0.25)' : 'none'}
              stroke="#ff6b00"
              strokeWidth={2}
            />
          )}
          {closed && vertices.length >= 3 && (
            <line
              x1={vertices[vertices.length - 1]![0]}
              y1={vertices[vertices.length - 1]![1]}
              x2={vertices[0]![0]}
              y2={vertices[0]![1]}
              stroke="#ff6b00"
              strokeWidth={2}
            />
          )}

          {/* Vertex-Punkte */}
          {vertices.map((v, i) => (
            <circle key={i} cx={v[0]} cy={v[1]} r={5} fill="#ff6b00" stroke="#fff" strokeWidth={1.5} />
          ))}

          {/* Kanten-Längen */}
          {edgeLabels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              fill="#fff"
              stroke="#000"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={12}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {l.text}
            </text>
          ))}
        </svg>
      </div>

      <div className="roof-tracer__hud">
        <p className="roof-tracer__instructions">
          {closed
            ? 'Polygon geschlossen. Längste Kante = First, kürzeste = Hausbreite.'
            : 'Klicken um Vertex hinzuzufügen. Doppelklick oder "Polygon schließen" um zu beenden.'}
        </p>
        {dimensions && (
          <ul className="roof-tracer__dimensions">
            <li><strong>First-Länge:</strong> {dimensions.firstLengthM.toFixed(2)} m</li>
            <li><strong>Haus-Breite:</strong> {dimensions.houseWidthM.toFixed(2)} m</li>
            <li><strong>First-Ausrichtung:</strong> {dimensions.ridgeBearingDeg.toFixed(0)}°</li>
          </ul>
        )}
        <div className="roof-tracer__actions">
          <button type="button" className="btn btn--ghost" onClick={reset} disabled={vertices.length === 0}>
            Zurücksetzen
          </button>
          {!closed && (
            <button type="button" className="btn" onClick={closePolygon} disabled={vertices.length < 3}>
              Polygon schließen
            </button>
          )}
          {closed && (
            <button type="button" className="btn btn--primary" onClick={confirm}>
              Übernehmen
            </button>
          )}
          {onCancel && (
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
