import { describe, expect, it } from 'vitest';
import { buildCategoryName, buildItemName, slugify, validateProjekt } from './logic';

describe('buildCategoryName', () => {
  it('kombiniert Firma und Ort', () => {
    expect(buildCategoryName('Bosch GmbH', 'Esslingen')).toBe('Bosch GmbH Esslingen');
  });
  it('normalisiert Whitespace', () => {
    expect(buildCategoryName('  Bosch   GmbH ', ' Esslingen ')).toBe('Bosch GmbH Esslingen');
  });
});

describe('buildItemName', () => {
  it('enthält Firma, Ort und Datum', () => {
    const name = buildItemName({ company: 'Bosch GmbH', location: 'Esslingen' }, new Date('2026-08-25T10:00:00'));
    expect(name).toBe('Bosch GmbH Esslingen – 25.08.2026');
  });
});

describe('slugify', () => {
  it('macht URL-taugliche Slugs mit Umlauten', () => {
    expect(slugify('Bosch GmbH Esslingen')).toBe('bosch-gmbh-esslingen');
    expect(slugify('Müller & Söhne')).toBe('mueller-soehne');
  });
});

describe('validateProjekt', () => {
  it('verlangt Firma und Ort', () => {
    expect(validateProjekt({})).toMatch(/Firmennamen/);
    expect(validateProjekt({ company: 'Bosch GmbH' })).toMatch(/Ort/);
    expect(validateProjekt({ company: 'Bosch GmbH', location: 'Esslingen' })).toBeNull();
  });
});
