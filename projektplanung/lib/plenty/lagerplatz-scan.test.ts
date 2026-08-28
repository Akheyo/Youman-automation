/**
 * Testet den Scan-Ablauf gegen eine simulierte Plenty-API: Bestandsliste als
 * Treiber, Nachladen der Varianten, Paging, Aushandeln des `with`-Parameters
 * und das häppchenweise Fortsetzen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ANTWORT = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Baut eine Listen-Seite im Plenty-Format. */
function seite<T>(nr: number, letzte: number, eintraege: T[], proSeite: number) {
  return {
    entries: nr > letzte ? [] : eintraege,
    page: nr,
    isLastPage: nr >= letzte,
    lastPageNumber: letzte,
    totalsCount: letzte * proSeite,
  };
}

/** Standard-Attrappe: Login, Lager, Bestand, Varianten. */
function plentyAttrappe(optionen: {
  bestand: (nr: number) => Record<string, unknown>[];
  letzteSeite: number;
  varianten?: (id: number) => Record<string, unknown>;
  proSeite?: number;
  aufrufe?: string[];
}) {
  const { bestand, letzteSeite, proSeite = 1, aufrufe } = optionen;
  const varianten = optionen.varianten ?? ((id: number) => ({ id, itemId: 1000 + id, number: `H1R1A${id}` }));
  return async (url: string) => {
    aufrufe?.push(url);
    if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
    if (url.includes('/rest/stockmanagement/warehouses')) {
      return ANTWORT({ entries: [{ id: 1, name: 'Haupthalle' }] });
    }
    if (url.includes('/rest/stockmanagement/stock')) {
      const nr = Number(new URL(url).searchParams.get('page'));
      return ANTWORT(seite(nr, letzteSeite, bestand(nr), proSeite));
    }
    if (url.includes('/rest/items/variations')) {
      const ids = (new URL(url).searchParams.get('id') ?? '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!ids.length) return ANTWORT({ entries: [{ id: 1, itemId: 1001 }], isLastPage: true });
      return ANTWORT({ entries: ids.map(varianten), isLastPage: true });
    }
    return ANTWORT({ entries: [] });
  };
}

describe('scanneLagerplaetze — Artikel mit Bestand', () => {
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

  it('meldet fehlende Konfiguration, statt zu scheitern', async () => {
    delete process.env.PLENTY_BASE_URL;
    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze();
    expect(res.ok).toBe(false);
    expect(res.konfiguriert).toBe(false);
    expect(res.error).toMatch(/nicht konfiguriert/);
    expect(res.naechsteSeite).toBeNull();
  });

  it('prüft nur Varianten mit Bestand und überspringt Nullbestände', async () => {
    vi.stubGlobal(
      'fetch',
      plentyAttrappe({
        letzteSeite: 1,
        proSeite: 3,
        bestand: () => [
          { variationId: 1, warehouseId: 1, netStock: 4, physicalStock: 4 },
          { variationId: 2, warehouseId: 1, netStock: 0, physicalStock: 0 },
          { variationId: 3, warehouseId: 1, netStock: 0, physicalStock: 2 },
        ],
      }),
    );

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 3 });

    expect(res.ok).toBe(true);
    expect(res.quelle).toBe('bestand');
    expect(res.gelesen).toBe(3);
    expect(res.geprueft).toBe(2); // Variante 2 hat keinen Bestand
    expect(res.ohneBestand).toBe(1);
    expect(res.befunde.map((b) => b.variationId)).toEqual([1, 3]);
    expect(res.befunde[0].code).toBe('H1R1A1');
    expect(res.befunde[0].bestand).toBe(4);
    expect(res.befunde[0].lager).toBe('Haupthalle');
    // Reservierter Bestand zählt weiterhin als „liegt im Lager".
    expect(res.befunde[1].bestandPhysisch).toBe(2);
  });

  it('summiert den Bestand einer Variante über mehrere Lager', async () => {
    vi.stubGlobal(
      'fetch',
      plentyAttrappe({
        letzteSeite: 1,
        proSeite: 2,
        bestand: () => [
          { variationId: 7, warehouseId: 1, netStock: 2, physicalStock: 2 },
          { variationId: 7, warehouseId: 2, netStock: 3, physicalStock: 3 },
        ],
      }),
    );

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 2 });
    expect(res.befunde).toHaveLength(1);
    expect(res.befunde[0].bestand).toBe(5);
    expect(res.befunde[0].lager).toBe('Haupthalle, Lager 2');
  });

  it('setzt nach dem Seitenlimit beim nächsten Aufruf fort', async () => {
    vi.stubGlobal(
      'fetch',
      plentyAttrappe({
        letzteSeite: 4,
        bestand: (nr) => [{ variationId: nr, warehouseId: 1, netStock: 1, physicalStock: 1 }],
      }),
    );

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const erste = await scanneLagerplaetze({ proSeite: 1, maxSeiten: 2 });
    expect(erste.fertig).toBe(false);
    expect(erste.geprueft).toBe(2);
    expect(erste.naechsteSeite).toBe(3);

    const zweite = await scanneLagerplaetze({ startSeite: erste.naechsteSeite!, proSeite: 1, maxSeiten: 2 });
    expect(zweite.fertig).toBe(true);
    expect(zweite.befunde.map((b) => b.variationId)).toEqual([3, 4]);
  });

  it('liest den Lagerplatz aus der Artikelbeschreibung', async () => {
    vi.stubGlobal(
      'fetch',
      plentyAttrappe({
        letzteSeite: 1,
        bestand: () => [{ variationId: 5, warehouseId: 1, netStock: 1, physicalStock: 1 }],
        varianten: (id) => ({
          id,
          itemId: 900,
          number: '100234',
          item: { texts: [{ name1: 'Drehmaschine', description: '<p>Lagerplatz: Halle 2 Regal 4 Fach 1</p>' }] },
        }),
      }),
    );

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 1 });
    expect(res.befunde[0].code).toBe('H2R4F1');
    expect(res.befunde[0].quelle).toBe('Beschreibung');
    expect(res.befunde[0].name).toBe('Drehmaschine');
  });

  it('meldet Artikel mit Bestand ohne erkennbaren Lagerplatz', async () => {
    vi.stubGlobal(
      'fetch',
      plentyAttrappe({
        letzteSeite: 1,
        bestand: () => [{ variationId: 5, warehouseId: 1, netStock: 3, physicalStock: 3 }],
        varianten: (id) => ({ id, itemId: 900, number: '100234' }),
      }),
    );

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 1 });
    expect(res.zusammenfassung.ohneTreffer).toBe(1);
    expect(res.befunde[0].bestand).toBe(3);
    expect(res.diagnose.some((d) => d.includes('Beschreibungen nachladen'))).toBe(true);
  });

  it('lädt Beschreibungen einzeln nach, wenn die Liste keine mitliefert', async () => {
    const basis = plentyAttrappe({
      letzteSeite: 1,
      bestand: () => [{ variationId: 5, warehouseId: 1, netStock: 1, physicalStock: 1 }],
      varianten: (id) => ({ id, itemId: 900, number: '100234' }),
    });
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/descriptions')) return ANTWORT([{ lang: 'de', description: 'Lagerplatz H3R2F5' }]);
      return basis(url);
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 1, texteNachladen: true });
    expect(res.befunde[0].code).toBe('H3R2F5');
    expect(res.diagnose.some((d) => d.includes('nachgeladen'))).toBe(true);
  });

  it('lädt Varianten einzeln, wenn Plenty den Mehrfach-ID-Filter ignoriert', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (url.includes('/rest/stockmanagement/warehouses')) return ANTWORT({ entries: [] });
      if (url.includes('/rest/stockmanagement/stock')) {
        const nr = Number(new URL(url).searchParams.get('page'));
        return ANTWORT(
          seite(nr, 1, [
            { variationId: 1, warehouseId: 1, netStock: 1, physicalStock: 1 },
            { variationId: 2, warehouseId: 1, netStock: 1, physicalStock: 1 },
          ], 2),
        );
      }
      const ids = (new URL(url).searchParams.get('id') ?? '').split(',').filter(Boolean);
      // Diese Instanz ignoriert den Filter bei mehreren IDs und liefert alles.
      if (ids.length !== 1) {
        return ANTWORT({ entries: [{ id: 99, itemId: 1 }, { id: 1, itemId: 1 }], isLastPage: true });
      }
      const id = Number(ids[0]);
      return ANTWORT({ entries: [{ id, itemId: 1, number: `H1R1A${id}` }], isLastPage: true });
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 2 });
    expect(res.ok).toBe(true);
    expect(res.befunde.map((b) => b.code)).toEqual(['H1R1A1', 'H1R1A2']);
    expect(res.diagnose.some((d) => d.includes('einzeln geladen'))).toBe(true);
  });

  it('gibt bei einem API-Fehler die bereits gelesenen Befunde zurück', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (url.includes('/rest/stockmanagement/warehouses')) return ANTWORT({ entries: [] });
      if (url.includes('/rest/stockmanagement/stock')) {
        const nr = Number(new URL(url).searchParams.get('page'));
        if (nr >= 2) return ANTWORT({ error: 'kaputt' }, 500);
        return ANTWORT(seite(nr, 5, [{ variationId: 1, warehouseId: 1, netStock: 1, physicalStock: 1 }], 1));
      }
      const ids = (new URL(url).searchParams.get('id') ?? '').split(',').map(Number).filter(Boolean);
      return ANTWORT({ entries: ids.map((id) => ({ id, itemId: 1, number: `H1R1A${id}` })), isLastPage: true });
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 1, maxSeiten: 5 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/HTTP 500/);
    expect(res.befunde).toHaveLength(1);
    expect(res.naechsteSeite).toBe(2);
  });
});

describe('scanneLagerplaetze — gesamter Artikelstamm (quelle: alle)', () => {
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

  it('geht ohne Bestandsfilter über alle Varianten', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      const nr = Number(new URL(url).searchParams.get('page'));
      const pro = Number(new URL(url).searchParams.get('itemsPerPage'));
      const eintraege = Array.from({ length: pro }, (_, k) => {
        const i = (nr - 1) * pro + k + 1;
        return { id: i, itemId: 1000 + i, number: `KK-H1R${i}A2` };
      });
      return ANTWORT(seite(nr, 2, eintraege, pro));
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ quelle: 'alle', proSeite: 2, maxSeiten: 10 });
    expect(res.fertig).toBe(true);
    expect(res.geprueft).toBe(4);
    expect(res.ohneBestand).toBe(0);
    expect(res.befunde[0].code).toBe('H1R1A2');
    expect(res.befunde[0].bestand).toBeNull();
  });

  it('weicht auf einen einfacheren with-Parameter aus, wenn Plenty ihn ablehnt', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (url.includes('variationDescription')) return ANTWORT({ error: 'unknown relation' }, 400);
      const nr = Number(new URL(url).searchParams.get('page'));
      return ANTWORT(seite(nr, 1, [{ id: 1, itemId: 1, number: 'H1R1A1' }], 1));
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ quelle: 'alle', proSeite: 1 });
    expect(res.ok).toBe(true);
    expect(res.diagnose.some((d) => d.includes('with=item"'))).toBe(true);
  });
});
