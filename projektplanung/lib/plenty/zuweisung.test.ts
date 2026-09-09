/**
 * Testet die Zuweisung gegen eine simulierte Plenty-API. Besonderes Augenmerk
 * auf die Sicherungen: Im Probelauf darf NICHTS geschrieben werden, und ohne
 * gültigen Ziel-Lagerort darf keine Buchung entstehen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ANTWORT = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Plenty-Attrappe; sammelt alle schreibenden Aufrufe zum Nachprüfen. */
function attrappe(opts: {
  orte?: Array<{ id: number; fullLabel: string }>;
  bestand?: number;
  buchungFehler?: boolean;
  fehlerText?: string;
  fehlerStatus?: number;
} = {}) {
  const orte = opts.orte ?? [
    { id: 8619, fullLabel: 'H1/R8/EA F15-K10' },
    { id: 4397, fullLabel: 'H1/R1/EB F12-0' },
  ];
  const geschrieben: Array<{ url: string; body: unknown }> = [];
  const fetchMock = async (url: string, init?: RequestInit) => {
    if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
    if (init?.method === 'PUT') {
      geschrieben.push({ url, body: JSON.parse(String(init.body)) });
      return opts.buchungFehler
        ? ANTWORT({ error: opts.fehlerText ?? 'nope' }, opts.fehlerStatus ?? 400)
        : ANTWORT({ ok: true });
    }
    if (url.includes('/locations')) return ANTWORT({ entries: orte, isLastPage: true, totalsCount: orte.length });
    if (url.includes('/stock/storageLocations')) {
      const menge = opts.bestand ?? 4;
      return ANTWORT({ entries: menge > 0 ? [{ variationId: 1, storageLocationId: 0, quantity: menge }] : [] });
    }
    if (url.includes('/rest/items/variations')) {
      const ids = (new URL(url).searchParams.get('id') ?? '').split(',').map(Number).filter(Boolean);
      return ANTWORT({ entries: ids.map((id) => ({ id, itemId: 900 + id })) });
    }
    return ANTWORT({ entries: [] });
  };
  return { fetchMock, geschrieben };
}

describe('weiseZu', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PLENTY_BASE_URL = 'https://test.plentymarkets-cloud01.com';
    process.env.PLENTY_USER = 'api';
    process.env.PLENTY_PASSWORD = 'geheim';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PLENTY_BASE_URL; delete process.env.PLENTY_USER; delete process.env.PLENTY_PASSWORD;
  });

  it('schreibt im Probelauf nichts', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu } = await import('./zuweisung');
    const res = await weiseZu([{ variationId: 1, ziel: 'H1/R8/EA F15-K10' }], { warehouseId: 106 });

    expect(res.probelauf).toBe(true);
    expect(geschrieben).toHaveLength(0);
    expect(res.geplant).toBe(1);
    expect(res.gebucht).toBe(0);
    expect(res.zeilen[0].status).toBe('geplant');
    expect(res.zeilen[0].zielId).toBe(8619);
  });

  it('holt im Probelauf weder Artikel-IDs noch Bestände', async () => {
    // Beides kostet je einen API-Aufruf pro Artikel und lief bei mehreren
    // tausend Zeilen in den Serverless-Timeout.
    const gerufen: string[] = [];
    const { fetchMock } = attrappe();
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => { gerufen.push(url); return fetchMock(url, init); });
    const { weiseZu } = await import('./zuweisung');
    const wuensche = Array.from({ length: 200 }, (_, i) => ({ variationId: i + 1, ziel: 'H1/R8/EA F15-K10' }));
    const res = await weiseZu(wuensche, { warehouseId: 106 });

    expect(res.geplant).toBe(200);
    expect(gerufen.some((u) => u.includes('/rest/items/variations'))).toBe(false);
    expect(gerufen.some((u) => u.includes('/stock/storageLocations'))).toBe(false);
    expect(res.zeilen[0].hinweis).toMatch(/beim Buchen/);
  });

  it('lädt Artikel-IDs nur für die Zeilen, die auch gebucht werden', async () => {
    const gerufen: string[] = [];
    const { fetchMock } = attrappe();
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => { gerufen.push(url); return fetchMock(url, init); });
    const { weiseZu } = await import('./zuweisung');
    const wuensche = Array.from({ length: 200 }, (_, i) => ({ variationId: i + 1, ziel: 'H1/R8/EA F15-K10' }));
    await weiseZu(wuensche, { warehouseId: 106, probelauf: false, maxBuchungen: 10 });

    // 10 Buchungen → eine einzige Sammelabfrage, nicht vier.
    expect(gerufen.filter((u) => u.includes('/rest/items/variations')).length).toBe(1);
  });

  it('bucht mit Grund 401 vom Standard-Lagerort auf den Zielplatz', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu, GRUND_UMLAGERUNG } = await import('./zuweisung');
    const res = await weiseZu([{ variationId: 1, ziel: 'H1/R8/EA F15-K10' }], { warehouseId: 106, probelauf: false });

    expect(res.gebucht).toBe(1);
    expect(geschrieben).toHaveLength(1);
    expect(geschrieben[0].url).toContain('/rest/items/901/variations/1/stock/redistribute');
    expect(geschrieben[0].body).toEqual({
      reasonId: GRUND_UMLAGERUNG,
      quantity: 4,
      currentWarehouseId: 106,
      currentStorageLocationId: 0,
      newWarehouseId: 106,
      newStorageLocationId: 8619,
    });
  });

  it('überspringt Zeilen, deren Lagerort es nicht gibt — ohne zu buchen', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu } = await import('./zuweisung');
    const res = await weiseZu([{ variationId: 1, ziel: 'H9/R9/EA F99-K99' }], { warehouseId: 106, probelauf: false });

    expect(res.uebersprungen).toBe(1);
    expect(res.gebucht).toBe(0);
    expect(geschrieben).toHaveLength(0);
    expect(res.zeilen[0].hinweis).toMatch(/existiert in Plenty nicht/);
  });

  it('bucht nicht, wenn auf dem Quell-Lagerort nichts liegt', async () => {
    const { fetchMock, geschrieben } = attrappe({ bestand: 0 });
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu } = await import('./zuweisung');
    const res = await weiseZu([{ variationId: 1, ziel: 'H1/R8/EA F15-K10' }], { warehouseId: 106, probelauf: false });

    expect(res.uebersprungen).toBe(1);
    expect(geschrieben).toHaveLength(0);
    expect(res.zeilen[0].hinweis).toMatch(/liegt nichts/);
  });

  it('hält die Obergrenze ein', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu } = await import('./zuweisung');
    const wuensche = [1, 2, 3, 4].map((v) => ({ variationId: v, ziel: 'H1/R8/EA F15-K10' }));
    const res = await weiseZu(wuensche, { warehouseId: 106, probelauf: false, maxBuchungen: 2 });

    expect(res.gebucht).toBe(2);
    expect(geschrieben).toHaveLength(2);
    // Was nicht mehr drankam, gilt nicht als übersprungen, sondern als offen —
    // die Oberfläche schickt genau diese Zeilen in der nächsten Runde noch
    // einmal, bis die Liste durch ist.
    expect(res.uebersprungen).toBe(0);
    expect(res.offen).toBe(2);
    expect(res.erledigt).toEqual([1, 2]);
  });

  it('meldet die Schreibbremse, statt die Zeile als Fehler abzuhaken', async () => {
    // Bremst PlentyONE, ist die Zeile nicht kaputt — sie kommt nach der Pause
    // noch einmal dran.
    const { fetchMock } = attrappe({ buchungFehler: true, fehlerText: 'short period write limit reached', fehlerStatus: 429 });
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu } = await import('./zuweisung');
    const res = await weiseZu([{ variationId: 1, ziel: 'H1/R8/EA F15-K10' }], {
      warehouseId: 106, probelauf: false,
    });

    expect(res.schreiblimit).toBe(true);
    expect(res.fehler).toBe(0);
    expect(res.offen).toBe(1);
    expect(res.erledigt).toEqual([]);
  });

  it('vermerkt einen Buchungsfehler je Zeile und läuft weiter', async () => {
    const { fetchMock } = attrappe({ buchungFehler: true });
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu } = await import('./zuweisung');
    const res = await weiseZu(
      [{ variationId: 1, ziel: 'H1/R8/EA F15-K10' }, { variationId: 2, ziel: 'H1/R1/EB F12-0' }],
      { warehouseId: 106, probelauf: false },
    );
    expect(res.ok).toBe(true);
    expect(res.fehler).toBe(2);
    expect(res.gebucht).toBe(0);
    expect(res.zeilen[0].hinweis).toMatch(/HTTP 400/);
  });

  it('nimmt eine vorgegebene Menge statt des vollen Bestands', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { weiseZu } = await import('./zuweisung');
    await weiseZu([{ variationId: 1, itemId: 555, ziel: 'H1/R8/EA F15-K10', menge: 2 }], { warehouseId: 106, probelauf: false });
    expect((geschrieben[0].body as { quantity: number }).quantity).toBe(2);
    expect(geschrieben[0].url).toContain('/rest/items/555/');
  });

  it('meldet fehlende Konfiguration, statt zu buchen', async () => {
    delete process.env.PLENTY_BASE_URL;
    const { weiseZu } = await import('./zuweisung');
    const res = await weiseZu([{ variationId: 1, ziel: 'H1/R8/EA F15-K10' }], { warehouseId: 106, probelauf: false });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/nicht konfiguriert/);
  });
});
