import { describe, expect, it } from 'vitest';
import {
  CALC,
  calculate,
  effectiveConsumption,
  investment,
  recommendedKwp,
  roiProjection,
  selfConsumptionRatio,
} from '@/lib/calculator';
import type { Consumption } from '@/types';

const baseConsumption: Consumption = {
  kwhYear: 4500,
  priceCtKwh: 35,
  hasEAuto: false,
  addons: { storage: false, wallbox: false, heatpump: false },
};

describe('effectiveConsumption', () => {
  it('returns base when no add-ons selected', () => {
    expect(effectiveConsumption(baseConsumption)).toBe(4500);
  });

  it('adds 3000 kWh for wallbox', () => {
    const c = { ...baseConsumption, addons: { ...baseConsumption.addons, wallbox: true } };
    expect(effectiveConsumption(c)).toBe(7500);
  });

  it('adds 4500 kWh for heat pump', () => {
    const c = { ...baseConsumption, addons: { ...baseConsumption.addons, heatpump: true } };
    expect(effectiveConsumption(c)).toBe(9000);
  });

  it('stacks wallbox + heat pump', () => {
    const c = {
      ...baseConsumption,
      addons: { storage: false, wallbox: true, heatpump: true },
    };
    expect(effectiveConsumption(c)).toBe(4500 + 3000 + 4500);
  });
});

describe('recommendedKwp', () => {
  it('caps at MAX_KWP regardless of consumption', () => {
    const heavyConsumer: Consumption = { ...baseConsumption, kwhYear: 60_000 };
    expect(recommendedKwp(heavyConsumer, 100)).toBe(CALC.MAX_KWP);
  });

  it('caps at availableKwp when roof is small', () => {
    const c = { ...baseConsumption, kwhYear: 9000 };
    expect(recommendedKwp(c, 5)).toBe(5);
  });

  it('returns optimal sizing for a typical 4500 kWh household', () => {
    // (4500 / 950) * 1.2 ≈ 5.68 kWp
    expect(recommendedKwp(baseConsumption, 20)).toBeCloseTo(5.68, 1);
  });

  it('never returns negative', () => {
    expect(recommendedKwp({ ...baseConsumption, kwhYear: 0 }, 0)).toBe(0);
  });
});

describe('selfConsumptionRatio', () => {
  it('uses 32% baseline without storage', () => {
    expect(selfConsumptionRatio(4500, 4500, baseConsumption.addons)).toBe(CALC.EVQ_NO_STORAGE);
  });

  it('uses 70% with storage', () => {
    expect(
      selfConsumptionRatio(4500, 4500, { ...baseConsumption.addons, storage: true }),
    ).toBe(CALC.EVQ_WITH_STORAGE);
  });

  it('reduces ratio when system is significantly oversized', () => {
    // ratio 2.0 → above 1.3 threshold → EVQ should decrease
    const evq = selfConsumptionRatio(9000, 4500, baseConsumption.addons);
    expect(evq).toBeLessThan(CALC.EVQ_NO_STORAGE);
    expect(evq).toBeGreaterThanOrEqual(CALC.EVQ_MIN);
  });

  it('clamps to EVQ_MAX', () => {
    // Even with unrealistic input, EVQ never exceeds 0.95.
    expect(
      selfConsumptionRatio(1000, 999, { storage: true, wallbox: false, heatpump: false }),
    ).toBeLessThanOrEqual(CALC.EVQ_MAX);
  });
});

describe('investment', () => {
  it('returns 1400 €/kWp without add-ons', () => {
    expect(investment(8, baseConsumption.addons)).toBe(11200);
  });

  it('adds 8000 € for storage', () => {
    expect(investment(8, { ...baseConsumption.addons, storage: true })).toBe(11200 + 8000);
  });

  it('adds 1500 € for wallbox', () => {
    expect(investment(8, { ...baseConsumption.addons, wallbox: true })).toBe(11200 + 1500);
  });

  it('does NOT add cost for heat pump', () => {
    // Heat pump is a separate purchase from the PV system.
    expect(investment(8, { ...baseConsumption.addons, heatpump: true })).toBe(11200);
  });
});

describe('calculate (integration)', () => {
  it('produces deterministic, sensible results for a typical 4-person household', () => {
    const r = calculate({
      availableKwp: 8,
      yearlyYieldKwh: 8 * 950,
      consumption: baseConsumption,
    });
    expect(r.recommendedKwp).toBeGreaterThan(5);
    expect(r.recommendedKwp).toBeLessThan(7);
    expect(r.moduleCount).toBeGreaterThanOrEqual(13);
    expect(r.moduleCount).toBeLessThanOrEqual(18);
    expect(r.yearlyYieldKwh).toBeGreaterThan(4500);
    expect(r.investmentEur).toBeGreaterThan(7000);
    expect(r.investmentEur).toBeLessThan(11000);
    expect(r.paybackYears).toBeGreaterThan(7);
    expect(r.paybackYears).toBeLessThan(15);
    expect(r.co2SavingsT).toBeGreaterThan(2);
    expect(r.treesEquivalent).toBeGreaterThan(150);
  });

  it('reflects storage uplift in self-consumption', () => {
    const noBattery = calculate({
      availableKwp: 8,
      yearlyYieldKwh: 8 * 950,
      consumption: baseConsumption,
    });
    const withBattery = calculate({
      availableKwp: 8,
      yearlyYieldKwh: 8 * 950,
      consumption: { ...baseConsumption, addons: { storage: true, wallbox: false, heatpump: false } },
    });
    expect(withBattery.selfConsumptionRatio).toBeGreaterThan(noBattery.selfConsumptionRatio);
    expect(withBattery.investmentEur).toBeGreaterThan(noBattery.investmentEur);
  });

  it('returns zero for empty roof', () => {
    const r = calculate({ availableKwp: 0, yearlyYieldKwh: 0, consumption: baseConsumption });
    expect(r.moduleCount).toBe(0);
    expect(r.yearlyYieldKwh).toBe(0);
    expect(r.yearlySavingsEur).toBe(0);
    expect(r.investmentEur).toBe(0);
  });

  it('produces ROI projection for 5/10/15/20 years', () => {
    const r = calculate({
      availableKwp: 8,
      yearlyYieldKwh: 8 * 950,
      consumption: baseConsumption,
    });
    const horizons = r.roiProjection.map((p) => p.yearsHorizon);
    expect(horizons).toEqual([5, 10, 15, 20]);
    // 20-year cumulative cost without PV must exceed 5-year cost.
    const r5 = r.roiProjection.find((p) => p.yearsHorizon === 5);
    const r20 = r.roiProjection.find((p) => p.yearsHorizon === 20);
    expect(r20!.costNoPV).toBeGreaterThan(r5!.costNoPV);
  });

  it('factors in price inflation for ROI', () => {
    const r = calculate({
      availableKwp: 8,
      yearlyYieldKwh: 8 * 950,
      consumption: baseConsumption,
    });
    const r10 = r.roiProjection.find((p) => p.yearsHorizon === 10)!;
    // Without inflation: 4500 kWh × 0.35 €/kWh × 10 = 15750. With 3% inflation: significantly more.
    expect(r10.costNoPV).toBeGreaterThan(15750);
    expect(r10.costNoPV).toBeLessThan(20000);
  });
});

describe('roiProjection', () => {
  it('subtracts feed-in revenue from PV cost', () => {
    const proj = roiProjection(baseConsumption, 1500, 3000, 11000);
    const five = proj.find((p) => p.yearsHorizon === 5)!;
    expect(five.costWithPV).toBeGreaterThan(0);
    expect(five.costWithPV).toBeGreaterThan(11000); // includes the investment
  });
});
