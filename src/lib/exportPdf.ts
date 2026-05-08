import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Vehicle } from '@/types';
import { KOSTEN_KATEGORIEN } from '@/types';
import { berechneKennzahlen } from './calculations';
import { formatDatum, formatEuro, formatProzent } from './format';

const KAT_LABEL = Object.fromEntries(KOSTEN_KATEGORIEN.map((k) => [k.value, k.label]));

export function exportVehiclePdf(vehicle: Vehicle): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const k = berechneKennzahlen(vehicle);
  const margin = 40;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${vehicle.marke} ${vehicle.modell}`, margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const stammzeile = [
    vehicle.kennzeichenIntern && `Kennzeichen: ${vehicle.kennzeichenIntern}`,
    vehicle.erstzulassung && `EZ: ${formatDatum(vehicle.erstzulassung)}`,
    vehicle.km != null && `${vehicle.km.toLocaleString('de-DE')} km`,
    vehicle.fin && `FIN: ${vehicle.fin}`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  if (stammzeile) {
    doc.text(stammzeile, margin, y);
    y += 14;
  }

  doc.text(`Status: ${vehicle.status === 'verkauft' ? 'Verkauft' : 'Im Bestand'}`, margin, y);
  y += 18;

  // Einkauf / Verkauf
  doc.setDrawColor(220);
  doc.line(margin, y, 555, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.text('Einkauf', margin, y);
  doc.text('Verkauf', 300, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatDatum(vehicle.ankaufsdatum)}  —  ${formatEuro(vehicle.ankaufspreis)}`, margin, y);
  doc.text(
    vehicle.verkaufspreis != null
      ? `${formatDatum(vehicle.verkaufsdatum)}  —  ${formatEuro(vehicle.verkaufspreis)}`
      : '— noch im Bestand —',
    300,
    y,
  );
  y += 20;

  // Kostentabelle
  if (vehicle.kosten.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Kategorie', 'Bezeichnung', 'Datum', 'Betrag']],
      body: vehicle.kosten.map((k) => [
        KAT_LABEL[k.kategorie] ?? k.kategorie,
        k.bezeichnung,
        formatDatum(k.datum),
        formatEuro(k.betrag),
      ]),
      foot: [['', '', 'Summe', formatEuro(k.kostenSumme)]],
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error lastAutoTable is added by jspdf-autotable
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  // Arbeit
  if (vehicle.arbeitsstunden.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Beschreibung', 'Datum', 'Stunden', '€']],
      body: vehicle.arbeitsstunden.map((a) => [
        a.beschreibung,
        formatDatum(a.datum),
        String(a.stunden),
        formatEuro(a.stunden * vehicle.stundensatz),
      ]),
      foot: [['', `${k.arbeitsstundenSumme} h × ${formatEuro(vehicle.stundensatz)}/h`, '', formatEuro(k.arbeitskostenSumme)]],
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  // Kennzahlen
  const rows: [string, string][] = [
    ['Einkaufspreis', formatEuro(vehicle.ankaufspreis)],
  ];
  if (vehicle.verkaufspreis != null) {
    rows.push(
      ['Verkaufspreis', formatEuro(vehicle.verkaufspreis)],
      ['Bruttogewinn (VK − EK)', formatEuro(k.bruttogewinn)],
      ['MwSt-Anteil (Differenzbesteuerung 19 %)', formatEuro(k.mwstBetrag)],
      ['Nettogewinn', formatEuro(k.nettogewinn)],
    );
  }
  rows.push(['Kostensumme', formatEuro(k.kostenSumme)]);
  if (k.arbeitskostenSumme > 0) rows.push(['Arbeitskosten', formatEuro(k.arbeitskostenSumme)]);

  autoTable(doc, {
    startY: y,
    body: rows,
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', cellWidth: 140 } },
    theme: 'plain',
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  if (vehicle.verkaufspreis != null) {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, 555 - margin, 60, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('GEWINNANTEIL', margin + 12, y + 22);
    doc.text('MARGE AUF EK', margin + 270, y + 22);
    doc.setFontSize(20);
    doc.text(formatEuro(k.gewinnanteil), margin + 12, y + 46);
    doc.text(formatProzent(k.margePct), margin + 270, y + 46);
    doc.setTextColor(0);
    y += 76;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Erstellt am ${formatDatum(new Date().toISOString())} · Berechnung nach §25a UStG (Differenzbesteuerung)`,
    margin,
    800,
  );

  doc.save(`${vehicle.marke}-${vehicle.modell}-${vehicle.id.slice(0, 6)}.pdf`);
}
