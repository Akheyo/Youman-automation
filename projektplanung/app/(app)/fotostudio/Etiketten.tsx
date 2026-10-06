'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ean13Balken, istFuehrungsmodul } from '@/lib/fotostudio/ean13-muster';
import type { Etikettformat } from '@/lib/fotostudio/etikett';

/**
 * Etiketten drucken — eines je Stück.
 *
 * Gedruckt wird über das Druckfenster des Browsers: Jedes Etikett ist eine
 * eigene Seite in genau der Größe der Rolle (`@page size`). Damit geht es mit
 * jedem Etikettendrucker, der am PC oder Handy als Drucker eingerichtet ist,
 * ohne Treiber-Sonderweg. Wer das Druckfenster überspringen will, startet
 * Chrome am Fotoplatz mit `--kiosk-printing`.
 *
 * Die Etiketten hängen per Portal direkt am <body>, damit beim Drucken alles
 * andere ausgeblendet werden kann, ohne Leerseiten zu erzeugen.
 */

export interface Druckauftrag {
  ean: string;
  itemId: number | null;
  nummer: number;
  zustand: string;
  anzahl: number;
}

const RUHEZONE = 9; // Module weißer Rand links und rechts, wie im Standard

export function Barcode({ ean, hoeheMm }: { ean: string; hoeheMm: number }) {
  const balken = useMemo(() => {
    try {
      return ean13Balken(ean);
    } catch {
      return null;
    }
  }, [ean]);
  if (!balken) return <p style={{ margin: 0, fontSize: '3mm' }}>EAN ungültig: {ean}</p>;

  const breite = 95 + RUHEZONE * 2;
  const hoehe = 60;
  return (
    <svg
      viewBox={`0 0 ${breite} ${hoehe + 5}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${hoeheMm}mm`, display: 'block' }}
      role="img"
      aria-label={`EAN ${ean}`}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width={breite} height={hoehe + 5} fill="#fff" />
      {balken.map(([start, b]) => (
        <rect
          key={start}
          x={start + RUHEZONE}
          y="0"
          width={b}
          height={istFuehrungsmodul(start) ? hoehe + 5 : hoehe}
          fill="#000"
        />
      ))}
    </svg>
  );
}

/** „4006381333931" → „4 006381 333931", wie unter jedem Strichcode. */
export function eanText(ean: string): string {
  return `${ean.slice(0, 1)} ${ean.slice(1, 7)} ${ean.slice(7)}`;
}

export default function Etiketten({
  auftrag,
  format,
  onFertig,
}: {
  auftrag: Druckauftrag | null;
  format: Etikettformat;
  onFertig: () => void;
}) {
  const [bereit, setBereit] = useState(false);
  useEffect(() => setBereit(true), []);

  useEffect(() => {
    if (!auftrag) return;
    const nachDruck = () => onFertig();
    window.addEventListener('afterprint', nachDruck);
    // Zwei Frames warten, bis die Etiketten im DOM und gelayoutet sind —
    // sonst druckt der Browser eine leere Seite.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', nachDruck);
    };
  }, [auftrag, onFertig]);

  if (!bereit || !auftrag) return null;

  const { breiteMm: b, hoeheMm: h } = format;
  const klein = h < 30;
  const css = `
@page { size: ${b}mm ${h}mm; margin: 0; }
#etikett-druck { display: none; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body > *:not(#etikett-druck) { display: none !important; }
  #etikett-druck { display: block !important; }
}`;

  const etiketten = Array.from({ length: auftrag.anzahl }, (_, i) => (
    <div
      key={i}
      style={{
        width: `${b}mm`,
        height: `${h}mm`,
        padding: `${klein ? 1.2 : 2}mm ${klein ? 2 : 3}mm`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        // Kein Umbruch nach dem letzten — sonst kommt ein leeres Etikett mit.
        ...(i < auftrag.anzahl - 1 ? { breakAfter: 'page' as const, pageBreakAfter: 'always' as const } : {}),
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2mm' }}>
        <strong style={{ fontSize: klein ? '3.4mm' : '4.2mm', lineHeight: 1 }}>
          {auftrag.itemId ? `Art. ${auftrag.itemId}` : `#${auftrag.nummer}`}
        </strong>
        <span style={{ fontSize: klein ? '2.4mm' : '2.8mm', lineHeight: 1 }}>{auftrag.zustand}</span>
      </div>
      <Barcode ean={auftrag.ean} hoeheMm={Math.max(h * (klein ? 0.5 : 0.55), 9)} />
      <div style={{ textAlign: 'center', fontSize: klein ? '2.8mm' : '3.2mm', letterSpacing: '0.4mm', lineHeight: 1 }}>
        {eanText(auftrag.ean)}
      </div>
    </div>
  ));

  return createPortal(
    <div id="etikett-druck" aria-hidden>
      <style>{css}</style>
      {etiketten}
    </div>,
    document.body,
  );
}
