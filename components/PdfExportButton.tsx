'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';

export default function PdfExportButton() {
  const address = useApp((s) => s.address);
  const result = useApp((s) => s.result);
  const layout = useApp((s) => s.layout);
  const consumption = useApp((s) => s.consumption);
  const [busy, setBusy] = useState(false);

  if (!result || !address) return null;

  async function handleExport() {
    if (!result || !address) return;
    setBusy(true);
    try {
      // Lazy-load jsPDF + html2canvas only when the user actually exports.
      const [{ default: jsPDF }, html2canvas] = await Promise.all([
        import('jspdf'),
        import('html2canvas').then((m) => m.default),
      ]);

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const lineH = 7;
      let y = 20;

      doc.setFontSize(18);
      doc.setTextColor('#0D73FC');
      doc.text('A&B Solarenergy — Konfigurations-Übersicht', 20, y);
      y += lineH * 1.5;

      doc.setFontSize(11);
      doc.setTextColor('#1d1d2e');
      doc.text(`Adresse: ${address.placeName}`, 20, y);
      y += lineH;
      doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 20, y);
      y += lineH * 1.5;

      const rows: [string, string][] = [
        ['Module (400 Wp)', String(result.moduleCount)],
        ['Anlagengröße', `${result.recommendedKwp} kWp`],
        ['Jahresertrag', `${result.yearlyYieldKwh.toLocaleString('de-DE')} kWh`],
        ['Eigenverbrauch', `${result.selfConsumptionKwh.toLocaleString('de-DE')} kWh (${Math.round(result.selfConsumptionRatio * 100)}%)`],
        ['Einspeisung', `${result.feedInKwh.toLocaleString('de-DE')} kWh`],
        ['Ersparnis / Jahr', `${result.yearlySavingsEur.toLocaleString('de-DE')} €`],
        ['Investition', `${result.investmentEur.toLocaleString('de-DE')} €`],
        ['Amortisation', `${result.paybackYears} Jahre`],
        ['CO₂-Einsparung', `${result.co2SavingsT} t/Jahr (≈ ${result.treesEquivalent} Bäume)`],
      ];
      doc.setFontSize(10);
      for (const [k, v] of rows) {
        doc.setTextColor('#7a8393');
        doc.text(k, 20, y);
        doc.setTextColor('#1d1d2e');
        doc.text(v, 90, y);
        y += lineH;
      }

      y += lineH;
      doc.setFontSize(9);
      doc.setTextColor('#7a8393');
      doc.text(
        `Annahmen: ${consumption.kwhYear.toLocaleString('de-DE')} kWh Verbrauch · ${consumption.priceCtKwh} ct/kWh Strompreis · 8 ct/kWh Einspeisevergütung`,
        20,
        y,
      );
      y += lineH;
      doc.text('Werte sind Schätzungen, finale Auslegung erfolgt durch A&B nach Begehung.', 20, y);

      // Try to capture the 3D viewer too.
      const canvas = document.querySelector<HTMLCanvasElement>('.cesium-viewer canvas');
      if (canvas) {
        try {
          const snap = await html2canvas(canvas as HTMLElement, { logging: false });
          const data = snap.toDataURL('image/jpeg', 0.85);
          doc.addPage();
          doc.text('Visualisierung', 20, 20);
          doc.addImage(data, 'JPEG', 20, 30, 170, 100);
        } catch {
          // Skip if canvas tainted or capture fails.
        }
      }

      void layout; // referenced for future panel-summary table
      doc.save(`pv-konfiguration-${Date.now()}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn--ghost" onClick={handleExport} disabled={busy}>
      {busy ? 'PDF wird erstellt…' : 'Als PDF herunterladen'}
    </button>
  );
}
