/**
 * Testet das Entfernen falsch angelegter Zweige.
 *
 * Der Fehler, der repariert wird: Die Anlage suchte Knoten ohne das Kürzel
 * der Spalte ("1" statt "H1"), fand nichts und baute einen zweiten Baum
 * daneben. Diese Tests sichern, dass genau dieser Zweig erkannt wird — und
 * dass nichts gelöscht wird, worauf Bestand liegt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findeFalscheZweige } from './lagerort-aufraeumen';

const ANTWORT = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Echte Struktur (H1 › R7 › EC › F16) plus der falsche Zweig (1 › 7 › C › 16). */
const KNOTEN = [
  { id: 3046, parentId: 0, dimensionId: 9, name: 'H1', position: 1 },
  { id: 3100, parentId: 3046, dimensionId: 10, name: 'R7', position: 1 },
  { id: 3110, parentId: 3100, dimensionId: 11, name: 'EC', position: 1 },
  { id: 3120, parentId: 3110, dimensionId: 7, name: 'F16', position: 1 },
  // Der falsche Zweig:
  { id: 10119, parentId: 0, dimensionId: 9, name: '1', position: 2 },
  { id: 10137, parentId: 10119, dimensionId: 10, name: '7', position: 1 },
  { id: 10138, parentId: 10137, dimensionId: 11, name: 'C', position: 1 },
  { id: 10139, parentId: 10138, dimensionId: 7, name: '16', position: 1 },
];

const ORTE = [
  { id: 900, name: 'H1/R7/EC F16-K01', code: 'H1/R7/EC F16-K01', status: 'active', zweck: 'picking', levelId: 3120 },
  { id: 15901, name: '1/7/C 16-K01', code: null, status: 'active', zweck: 'picking', levelId: 10139 },
  { id: 15902, name: '1/7/C 16-K02', code: null, status: 'active', zweck: 'picking', levelId: 10139 },
];

describe('findeFalscheZweige', () => {
  it('erkennt den Zweig, dessen oberster Knoten das Kürzel nicht trägt', () => {
    const zweige = findeFalscheZweige(KNOTEN, ORTE, 9, 'H');
    expect(zweige).toHaveLength(1);
    expect(zweige[0].wurzel.id).toBe(10119);
    // Wurzel plus drei Stufen darunter.
    expect(zweige[0].knoten.map((k) => k.id).sort()).toEqual([10119, 10137, 10138, 10139]);
    expect(zweige[0].orte.map((o) => o.id).sort()).toEqual([15901, 15902]);
  });

  it('lässt den echten Baum unangetastet', () => {
    const zweige = findeFalscheZweige(KNOTEN, ORTE, 9, 'H');
    const angefasst = zweige.flatMap((z) => z.knoten.map((k) => k.id));
    expect(angefasst).not.toContain(3046);
    expect(angefasst).not.toContain(3120);
    expect(zweige.flatMap((z) => z.orte.map((o) => o.id))).not.toContain(900);
  });

  it('meldet nichts, wenn alle obersten Knoten das Kürzel tragen', () => {
    const nurEcht = KNOTEN.filter((k) => k.id < 10000);
    expect(findeFalscheZweige(nurEcht, ORTE, 9, 'H')).toHaveLength(0);
  });

  it('meldet nichts, wenn die Spalte kein Kürzel hat — dann ist keine Entscheidung möglich', () => {
    expect(findeFalscheZweige(KNOTEN, ORTE, 9, '')).toHaveLength(0);
  });
});

describe('raeumeAuf', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PLENTY_BASE_URL = 'https://test.plentymarkets-cloud01.com';
    process.env.PLENTY_USER = 'api';
    process.env.PLENTY_PASSWORD = 'geheim';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PLENTY_BASE_URL;
    delete process.env.PLENTY_USER;
    delete process.env.PLENTY_PASSWORD;
  });

  function attrappe(opts: { bestandAuf?: number[] } = {}) {
    const geloescht: string[] = [];
    const fetchMock = async (url: string, init?: RequestInit) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (init?.method === 'DELETE') {
        geloescht.push(url.replace('https://test.plentymarkets-cloud01.com', ''));
        return ANTWORT({ ok: true });
      }
      if (url.includes('/stock/storageLocations')) {
        return ANTWORT({
          entries: (opts.bestandAuf ?? []).map((id) => ({ storageLocationId: id, quantity: 3 })),
          isLastPage: true,
        });
      }
      if (url.includes('/locations/dimensions')) {
        return ANTWORT({
          entries: [
            { id: 9, level: 1, name: 'Halle', shortcut: 'H' },
            { id: 10, level: 2, name: 'Regal', shortcut: 'R' },
            { id: 11, level: 3, name: 'Ebene', shortcut: 'E' },
            { id: 7, level: 4, name: 'Feld', shortcut: 'F' },
          ],
          isLastPage: true,
        });
      }
      if (url.includes('/locations/levels')) return ANTWORT({ entries: KNOTEN, isLastPage: true });
      if (url.includes('/locations')) {
        return ANTWORT({
          entries: ORTE.map((o) => ({ id: o.id, fullLabel: o.name, levelId: o.levelId, purposeKey: o.zweck, statusKey: o.status })),
          isLastPage: true,
        });
      }
      return ANTWORT({ entries: [], isLastPage: true });
    };
    return { fetchMock, geloescht };
  }

  it('löscht im Probelauf nichts', async () => {
    const { fetchMock, geloescht } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { raeumeAuf } = await import('./lagerort-aufraeumen');
    const res = await raeumeAuf({ warehouseId: 106 });

    expect(res.probelauf).toBe(true);
    expect(geloescht).toHaveLength(0);
    expect(res.orteGesamt).toBe(2);
    expect(res.knotenGesamt).toBe(4);
    expect(res.zweige[0].name).toBe('1');
  });

  it('löscht erst die Lagerorte, dann die Knoten von unten nach oben', async () => {
    const { fetchMock, geloescht } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { raeumeAuf } = await import('./lagerort-aufraeumen');
    const res = await raeumeAuf({ warehouseId: 106, probelauf: false });

    expect(res.orteGeloescht).toBe(2);
    expect(res.knotenGeloescht).toBe(4);
    expect(res.fehler).toBe(0);
    // Erst die beiden Lagerorte …
    expect(geloescht.slice(0, 2)).toEqual([
      '/rest/warehouses/locations/15901',
      '/rest/warehouses/locations/15902',
    ]);
    // … dann die Knoten, tiefster zuerst.
    expect(geloescht.slice(2)).toEqual([
      '/rest/warehouses/locations/levels/10139',
      '/rest/warehouses/locations/levels/10138',
      '/rest/warehouses/locations/levels/10137',
      '/rest/warehouses/locations/levels/10119',
    ]);
    // Der echte Baum bleibt unberührt.
    expect(geloescht.join(' ')).not.toContain('/3120');
    expect(geloescht.join(' ')).not.toContain('/900');
  });

  it('löscht nichts, wenn auf einem der Lagerorte Bestand liegt', async () => {
    const { fetchMock, geloescht } = attrappe({ bestandAuf: [15902] });
    vi.stubGlobal('fetch', fetchMock);
    const { raeumeAuf } = await import('./lagerort-aufraeumen');
    const res = await raeumeAuf({ warehouseId: 106, probelauf: false });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Bestand');
    expect(geloescht).toHaveLength(0);
  });
});
