/**
 * PV-Ertragstabelle nach PLZ-Region und Ausrichtung.
 *
 * 1:1 Portierung des A&B-Sheets "Einheitliche PV-Erträge" (kWh/kWp/Jahr).
 *
 *   Region        PLZ-Range   Süd   Ost   West  Nord
 *   ----------    ---------   ---   ---   ----  ----
 *   Norden        2xxxx       900   675   660   540
 *   Osten         0-1xxxx     1000  750   730   600
 *   Mitte/Westen  3-6xxxx     975   730   710   585
 *   Süden         7-9xxxx     1100  825   800   660
 *
 * Wenn die PLZ unbekannt ist, wird der Durchschnitt aller Regionen verwendet
 * (Süd 993.75, Ost 745, West 725, Nord 596.25 — exakt wie im Sheet).
 *
 * Die Tabelle deckt PV-Modul-Erträge in Deutschland ab; sie ersetzt den
 * statischen 950-kWh/kWp-Default in `lib/calculator.ts` sobald die PLZ
 * bekannt ist. PVGIS bleibt der präzisere Pfad (live, schattenkorrigiert).
 */

import type { Aspect } from './roof-geometry';

export type Region = 'norden' | 'osten' | 'mitte-westen' | 'sueden';

export const YIELD_TABLE: Record<Region, Record<Aspect, number>> = {
  norden: { sued: 900, ost: 675, west: 660, nord: 540 },
  osten: { sued: 1000, ost: 750, west: 730, nord: 600 },
  'mitte-westen': { sued: 975, ost: 730, west: 710, nord: 585 },
  sueden: { sued: 1100, ost: 825, west: 800, nord: 660 },
};

/** Durchschnitt über alle vier Regionen (entspricht Spalte "Durchschnitt" im Sheet). */
export const YIELD_AVERAGE: Record<Aspect, number> = {
  sued: 993.75,
  ost: 745,
  west: 725,
  nord: 596.25,
};

export const REGION_LABEL: Record<Region, string> = {
  norden: 'Norden (PLZ 2xxxx)',
  osten: 'Osten (PLZ 0–1xxxx)',
  'mitte-westen': 'Mitte/Westen (PLZ 3–6xxxx)',
  sueden: 'Süden (PLZ 7–9xxxx)',
};

/**
 * Bestimmt die Region anhand der ersten PLZ-Ziffer.
 *
 *   0-1 → Osten   (Berlin, Sachsen, Brandenburg, Sachsen-Anhalt, Thüringen)
 *   2   → Norden  (Hamburg, Bremen, Niedersachsen, Schleswig-Holstein)
 *   3-6 → Mitte/Westen (NRW, Hessen, RLP, Saarland)
 *   7-9 → Süden   (Bayern, BaWü)
 */
export function regionFromPlz(plz: string | number | null | undefined): Region | null {
  if (plz === null || plz === undefined) return null;
  const str = String(plz).trim();
  if (!/^\d/.test(str)) return null;
  const first = str.charCodeAt(0) - 48;
  if (first === 0 || first === 1) return 'osten';
  if (first === 2) return 'norden';
  if (first >= 3 && first <= 6) return 'mitte-westen';
  if (first >= 7 && first <= 9) return 'sueden';
  return null;
}

/**
 * Spezifischer Ertrag (kWh/kWp/Jahr) für eine Region und Ausrichtung.
 *
 * Wenn keine Region bekannt: Durchschnitt aus allen vier Regionen.
 */
export function specificYield(region: Region | null, aspect: Aspect): number {
  if (!region) return YIELD_AVERAGE[aspect];
  return YIELD_TABLE[region][aspect];
}

/**
 * Wandelt einen kompass-Azimut (0=N, 90=O, 180=S, 270=W) in eine der vier
 * Hauptausrichtungen um. Toleranz ±45°.
 */
export function aspectFromAzimuth(azimuthDeg: number): Aspect {
  const a = ((azimuthDeg % 360) + 360) % 360;
  if (a >= 315 || a < 45) return 'nord';
  if (a < 135) return 'ost';
  if (a < 225) return 'sued';
  return 'west';
}

/**
 * Anlagenertrag für eine Seite (entspricht Sheet 2, Zeile "Anlagenertrag").
 *
 *   Anlagenertrag (kWh/Jahr) = kWp · spezifischer Ertrag (Region, Ausrichtung)
 *
 * Beispiel aus dem Sheet:
 *   Seite A OST (Mitte/Westen-Durchschnitt): 14.4 · 745  = 10728 kWh/Jahr
 *   Seite B WEST (Mitte/Westen-Durchschnitt): 14.4 · 725 = 10440 kWh/Jahr
 */
export function yieldPerSide(kwp: number, region: Region | null, aspect: Aspect): number {
  return Math.round(kwp * specificYield(region, aspect));
}

/**
 * Gesamtertrag einer Anlage über mehrere Seiten.
 */
export interface SideYieldInput {
  kwp: number;
  aspect: Aspect;
}

export function totalYield(sides: SideYieldInput[], region: Region | null): number {
  return sides.reduce((sum, s) => sum + yieldPerSide(s.kwp, region, s.aspect), 0);
}
