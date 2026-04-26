/**
 * PV Wirtschaftlichkeits-Calculator.
 *
 * Konstanten und Formeln 1:1 portiert aus pv-konfigurator.html (validiert mit
 * A&B-Vertrieb). Reine Funktion, keine Side Effects — direkt in Vitest testbar.
 *
 * Annahmen (Quelle: pv-konfigurator.html, Zeilen 3443-3559):
 *   - 950 kWh/kWp/Jahr ist der NRW-Durchschnitt (südliche Dachneigung 30°).
 *     Wird durch PVGIS-Wert ersetzt sobald verfügbar.
 *   - 400 Wp pro Modul, 1.7m × 1.1m.
 *   - Eigenverbrauchsquote ohne Speicher: 32%, mit 10-kWh-Speicher: 70%.
 *     Skaliert nach unten wenn Anlage stark überdimensioniert (>1.3× Verbrauch).
 *   - Einspeisevergütung: 8 ct/kWh (KfW-Stand 2025).
 *   - Investitions-Pauschale: 1400 €/kWp (Kompletanlage inkl. Montage).
 *   - Speicher-Aufpreis: 8000 € (10-kWh-Lithium).
 *   - Wallbox-Aufpreis: 1500 €. +3000 kWh/Jahr Verbrauch.
 *   - Wärmepumpe: kein PV-Aufpreis (separate Anschaffung). +4500 kWh/Jahr.
 *   - CO₂-Faktor Strommix DE 2024: 0.434 kg/kWh (UBA).
 *   - Baum-Äquivalent: 80 Bäume/Tonne CO₂/Jahr.
 *   - Strompreis-Inflation für ROI-Projektion: 3% p.a.
 */

import type { AddOns, Consumption, PVCalculation, ROIProjection } from '@/types';

// ---------------------------------------------------------------------------
// Konstanten — public, damit der Sidebar-Tooltip sie referenzieren kann.
// ---------------------------------------------------------------------------

export const CALC = {
  /** Watt-Peak pro Modul. */
  PANEL_WP: 400,
  /** kWh pro kWp pro Jahr — NRW-Default ohne PVGIS. */
  KWH_PER_KWP_NRW: 950,
  /** Sizing-Faktor: 20% Überdimensionierung als Reserve. */
  SIZING_FACTOR: 1.2,
  /** Kappung der empfohlenen Anlage (kWp) — sonst Sondersteuern (>30 kWp). */
  MAX_KWP: 30,
  /** Eigenverbrauchsquote ohne Speicher. */
  EVQ_NO_STORAGE: 0.32,
  /** Eigenverbrauchsquote mit 10-kWh-Speicher. */
  EVQ_WITH_STORAGE: 0.70,
  /** Mindest-Eigenverbrauchsquote (Floor bei Überdimensionierung). */
  EVQ_MIN: 0.15,
  /** Maximum Eigenverbrauchsquote. */
  EVQ_MAX: 0.95,
  /** Skalierungsfaktor: ab welchem Verhältnis Ertrag/Verbrauch wird EVQ reduziert? */
  EVQ_OVERSIZE_THRESHOLD: 1.3,
  /** Wie stark wird EVQ pro Einheit Überdimensionierung skaliert? */
  EVQ_OVERSIZE_SLOPE: 0.25,
  /** Einspeisevergütung in EUR pro kWh. */
  FEED_IN_EUR_KWH: 0.08,
  /** Investition pro kWp (Komplettanlage inkl. Montage), EUR. */
  EUR_PER_KWP: 1400,
  /** Speicher-Aufpreis (EUR). */
  EUR_STORAGE: 8000,
  /** Wallbox-Aufpreis (EUR). */
  EUR_WALLBOX: 1500,
  /** Zusatzverbrauch durch Wallbox (kWh/Jahr). */
  KWH_WALLBOX: 3000,
  /** Zusatzverbrauch durch Wärmepumpe (kWh/Jahr). */
  KWH_HEATPUMP: 4500,
  /** CO₂-Faktor deutscher Strommix in t pro kWh. */
  CO2_T_PER_KWH: 0.000434,
  /** Bäume pro Tonne CO₂ pro Jahr (Faustregel: 80). */
  TREES_PER_T_CO2: 80,
  /** Strompreis-Inflation für ROI-Projektion. */
  PRICE_INFLATION: 0.03,
  /** Zeit-Horizonte für ROI-Projektion. */
  ROI_HORIZONS: [5, 10, 15, 20] as const,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Effektiver Jahresverbrauch nach Berücksichtigung der Add-ons.
 * Wallbox addiert 3000 kWh, Wärmepumpe addiert 4500 kWh.
 */
export function effectiveConsumption(c: Consumption): number {
  let kwh = c.kwhYear;
  if (c.addons.wallbox) kwh += CALC.KWH_WALLBOX;
  if (c.addons.heatpump) kwh += CALC.KWH_HEATPUMP;
  return kwh;
}

/**
 * Empfohlene Anlagengröße in kWp.
 *
 * Faustregel: Verbrauch / 950 (kWh/kWp) × 1.2 Reserve, gekappt auf
 * `availableKwp` (was technisch aufs Dach passt) und `MAX_KWP` (Steuerschwelle).
 */
export function recommendedKwp(consumption: Consumption, availableKwp: number): number {
  const totalKwh = effectiveConsumption(consumption);
  const optimal = (totalKwh / CALC.KWH_PER_KWP_NRW) * CALC.SIZING_FACTOR;
  return clamp(Math.min(optimal, availableKwp), 0, CALC.MAX_KWP);
}

/**
 * Eigenverbrauchsquote nach Speicher-Status und Überdimensionierung.
 */
export function selfConsumptionRatio(
  yearlyYieldKwh: number,
  totalKwhDemand: number,
  addons: AddOns,
): number {
  let evq = addons.storage ? CALC.EVQ_WITH_STORAGE : CALC.EVQ_NO_STORAGE;
  const ratio = yearlyYieldKwh / Math.max(totalKwhDemand, 1);
  if (ratio > CALC.EVQ_OVERSIZE_THRESHOLD) {
    evq *= 1 - (ratio - CALC.EVQ_OVERSIZE_THRESHOLD) * CALC.EVQ_OVERSIZE_SLOPE;
  }
  return clamp(evq, CALC.EVQ_MIN, CALC.EVQ_MAX);
}

/**
 * Investitionskosten in EUR.
 *   1400 €/kWp + 8000 € Speicher + 1500 € Wallbox.
 *   Wärmepumpe wird NICHT addiert — sie ist keine PV-Komponente.
 */
export function investment(kwp: number, addons: AddOns): number {
  let inv = kwp * CALC.EUR_PER_KWP;
  if (addons.storage) inv += CALC.EUR_STORAGE;
  if (addons.wallbox) inv += CALC.EUR_WALLBOX;
  return Math.round(inv);
}

/**
 * ROI-Projektion: kumulative Stromkosten ohne vs. mit PV über N Jahre.
 * Berücksichtigt 3% jährliche Strompreis-Inflation.
 */
export function roiProjection(
  consumption: Consumption,
  selfConsumptionKwh: number,
  feedInKwh: number,
  investmentEur: number,
): ROIProjection[] {
  const baseKwh = effectiveConsumption(consumption);
  const basePrice = consumption.priceCtKwh / 100;

  return CALC.ROI_HORIZONS.map((horizon) => {
    let costNoPV = 0;
    let costPV = 0;
    for (let t = 0; t < horizon; t++) {
      const price = basePrice * Math.pow(1 + CALC.PRICE_INFLATION, t);
      costNoPV += baseKwh * price;
      // costPV: nur Restbedarf bezahlen, Einspeisung gegenrechnen.
      costPV += (baseKwh - selfConsumptionKwh) * price - feedInKwh * CALC.FEED_IN_EUR_KWH;
    }
    costPV += investmentEur;
    return {
      yearsHorizon: horizon,
      costNoPV: Math.max(0, Math.round(costNoPV)),
      costWithPV: Math.max(0, Math.round(costPV)),
    };
  });
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

export interface CalculatorInput {
  /** Verfügbare kWp basierend auf platzierten Modulen. */
  availableKwp: number;
  /** Jahres-Ertrag in kWh — aus PVGIS oder NRW-Default `availableKwp × 950`. */
  yearlyYieldKwh: number;
  consumption: Consumption;
}

/**
 * Vollständige Wirtschaftlichkeits-Berechnung.
 *
 * Liefert deterministisch — gleicher Input → gleicher Output. Keine I/O.
 */
export function calculate(input: CalculatorInput): PVCalculation {
  const { availableKwp, yearlyYieldKwh, consumption } = input;
  const { addons } = consumption;

  const recKwp = recommendedKwp(consumption, availableKwp);
  // Wenn weniger Module empfohlen als technisch möglich, skaliert der Ertrag entsprechend.
  const ertrag = availableKwp > 0 ? yearlyYieldKwh * (recKwp / availableKwp) : 0;

  const moduleCount = Math.round((recKwp * 1000) / CALC.PANEL_WP);

  const totalKwh = effectiveConsumption(consumption);
  const evq = selfConsumptionRatio(ertrag, totalKwh, addons);
  const eigen = Math.min(ertrag * evq, totalKwh);
  const einspeis = Math.max(0, ertrag - eigen);

  const priceEurKwh = consumption.priceCtKwh / 100;
  const ersparnis = eigen * priceEurKwh + einspeis * CALC.FEED_IN_EUR_KWH;
  const investi = investment(recKwp, addons);
  const amort = ersparnis > 0 ? investi / ersparnis : 0;

  const co2 = ertrag * CALC.CO2_T_PER_KWH;
  const baeume = co2 * CALC.TREES_PER_T_CO2;

  return {
    recommendedKwp: Math.round(recKwp * 100) / 100,
    moduleCount,
    yearlyYieldKwh: Math.round(ertrag),
    selfConsumptionKwh: Math.round(eigen),
    selfConsumptionRatio: Math.round(evq * 1000) / 1000,
    feedInKwh: Math.round(einspeis),
    yearlySavingsEur: Math.round(ersparnis),
    investmentEur: investi,
    paybackYears: Math.round(amort * 10) / 10,
    co2SavingsT: Math.round(co2 * 100) / 100,
    treesEquivalent: Math.round(baeume),
    roiProjection: roiProjection(consumption, eigen, einspeis, investi),
  };
}
