import { describe, expect, it } from 'vitest';
import { signPayload, validateLead } from '@/lib/lead';

const valid = {
  name: 'Max Mustermann',
  phone: '+49 1234 567890',
  email: 'max@example.de',
  timeframe: 'sofort',
  address: 'Mölndalstraße 8, 46325 Borken',
  lat: 51.84,
  lng: 6.86,
  consumption: { kwhYear: 4500, priceCtKwh: 35, hasEAuto: false, addons: { storage: false, wallbox: false, heatpump: false } },
  calculation: { recommendedKwp: 6, moduleCount: 15, yearlyYieldKwh: 5700, yearlySavingsEur: 1200, investmentEur: 8400, paybackYears: 7, co2SavingsT: 2.5 },
  timestamp: new Date().toISOString(),
  consent: true,
  source: 'standalone',
};

describe('validateLead', () => {
  it('accepts a valid payload', () => {
    expect(validateLead(valid)).toEqual([]);
  });

  it('rejects missing required string fields', () => {
    const errors = validateLead({ ...valid, name: '' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('rejects malformed e-mail', () => {
    const errors = validateLead({ ...valid, email: 'not-an-email' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'email' }));
  });

  it('requires DSGVO consent === true', () => {
    const errors = validateLead({ ...valid, consent: false });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'consent' }));
  });

  it('rejects non-object payload', () => {
    expect(validateLead(null)).toHaveLength(1);
    expect(validateLead('foo')).toHaveLength(1);
  });

  it('rejects missing consumption and calculation', () => {
    const stripped = { ...valid };
    // @ts-expect-error — testing defensive behaviour
    delete stripped.consumption;
    // @ts-expect-error
    delete stripped.calculation;
    const errors = validateLead(stripped);
    expect(errors.some((e) => e.field === 'consumption')).toBe(true);
    expect(errors.some((e) => e.field === 'calculation')).toBe(true);
  });
});

describe('signPayload', () => {
  it('returns sha256= prefix', () => {
    const sig = signPayload('hello', 'secret');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('is deterministic for same input', () => {
    expect(signPayload('hello', 'secret')).toBe(signPayload('hello', 'secret'));
  });

  it('changes when payload changes', () => {
    expect(signPayload('hello', 'secret')).not.toBe(signPayload('world', 'secret'));
  });

  it('changes when secret changes', () => {
    expect(signPayload('hello', 'secret')).not.toBe(signPayload('hello', 'other'));
  });
});
