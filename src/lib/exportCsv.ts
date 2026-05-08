import type { Vehicle } from '@/types';
import { berechneKennzahlen } from './calculations';

/** Erzeugt eine CSV-Zeichenkette mit deutscher Lokalisierung (Semikolon, Komma als Dezimal). */
export function vehiclesToCsv(vehicles: Vehicle[]): string {
  const header = [
    'Marke',
    'Modell',
    'Kennzeichen',
    'EZ',
    'KM',
    'Status',
    'Ankaufsdatum',
    'EK',
    'Verkaufsdatum',
    'VK',
    'Käufer',
    'Kostensumme',
    'Arbeitsstunden',
    'Arbeitskosten',
    'Bruttogewinn',
    'Nettogewinn',
    'Gewinnanteil',
    'Marge%',
    'Standzeit (Tage)',
  ];

  const rows = vehicles.map((v) => {
    const k = berechneKennzahlen(v);
    return [
      v.marke,
      v.modell,
      v.kennzeichenIntern ?? '',
      v.erstzulassung ?? '',
      v.km != null ? String(v.km) : '',
      v.status === 'verkauft' ? 'Verkauft' : 'Im Bestand',
      v.ankaufsdatum,
      formatN(v.ankaufspreis),
      v.verkaufsdatum ?? '',
      formatN(v.verkaufspreis),
      v.kaeufer ?? '',
      formatN(k.kostenSumme),
      formatN(k.arbeitsstundenSumme),
      formatN(k.arbeitskostenSumme),
      formatN(k.bruttogewinn),
      formatN(k.nettogewinn),
      formatN(k.gewinnanteil),
      formatN(k.margePct),
      String(k.standzeitTage),
    ];
  });

  // BOM für Excel-Erkennung von UTF-8
  return (
    '﻿' +
    [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  );
}

function formatN(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toFixed(2).replace('.', ',');
}

function csvCell(v: string): string {
  if (v == null) return '';
  if (/[";\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
