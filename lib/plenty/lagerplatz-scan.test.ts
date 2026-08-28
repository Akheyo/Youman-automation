/**
 * Testet den Scan-Ablauf gegen eine simulierte Plenty-API: Paging,
 * Aushandeln des `with`-Parameters, Nachladen von Beschreibungen und das
 * häppchenweise Fortsetzen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ANTWORT = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Baut eine Varianten-Seite mit fortlaufenden IDs. */
function seite(nr: number, proSeite: number, letzte: number, macher: (i: number) => Record<string, unknown>) {
  const entries = nr > letzte ? [] : Array.from({ length: proSeite }, (_, k) => macher((nr - 1) * proSeite + k + 1));
  return { entries, page: nr, isLastPage: nr >= letzte, lastPageNumber: letzte, totalsCount: letzte * proSeite };
}

describe('scanneLagerplaetze', () => {
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

  it('liest alle Seiten und erkennt Lagerplätze aus der Variantennummer', async () => {
    const gerufen: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      gerufen.push(url);
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      const nr = Number(new URL(url).searchParams.get('page'));
      const pro = Number(new URL(url).searchParams.get('itemsPerPage'));
      return ANTWORT(seite(nr, pro, 3, (i) => ({ id: i, itemId: 1000 + i, number: `KK-H1R${i}A2` })));
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 2, maxSeiten: 10 });

    expect(res.ok).toBe(true);
    expect(res.fertig).toBe(true);
    expect(res.naechsteSeite).toBeNull();
    expect(res.gelesen).toBe(6);
    expect(res.gesamtLautPlenty).toBe(6);
    expect(res.zusammenfassung.gefunden).toBe(6);
    expect(res.befunde[0].code).toBe('H1R1A2');
    // Der erste Aufruf handelt den with-Parameter aus, danach wird gelesen.
    expect(gerufen.some((u) => u.includes('with=item%2CvariationDescription') || u.includes('with=item,variationDescription'))).toBe(true);
  });

  it('setzt nach dem Seitenlimit beim nächsten Aufruf fort', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      const nr = Number(new URL(url).searchParams.get('page'));
      const pro = Number(new URL(url).searchParams.get('itemsPerPage'));
      return ANTWORT(seite(nr, pro, 4, (i) => ({ id: i, itemId: i, number: `H1R1A${i}` })));
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const ersteHaelfte = await scanneLagerplaetze({ proSeite: 1, maxSeiten: 2 });
    expect(ersteHaelfte.fertig).toBe(false);
    expect(ersteHaelfte.gelesen).toBe(2);
    expect(ersteHaelfte.naechsteSeite).toBe(3);

    const zweiteHaelfte = await scanneLagerplaetze({ startSeite: ersteHaelfte.naechsteSeite!, proSeite: 1, maxSeiten: 2 });
    expect(zweiteHaelfte.fertig).toBe(true);
    expect(zweiteHaelfte.gelesen).toBe(2);
    expect(zweiteHaelfte.befunde[0].variationId).toBe(3);
  });

  it('weicht auf einen einfacheren with-Parameter aus, wenn Plenty ihn ablehnt', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (url.includes('variationDescription')) return ANTWORT({ error: 'unknown relation' }, 400);
      const nr = Number(new URL(url).searchParams.get('page'));
      const pro = Number(new URL(url).searchParams.get('itemsPerPage'));
      return ANTWORT(seite(nr, pro, 1, (i) => ({ id: i, itemId: i, number: `H1R1A${i}` })));
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 1 });
    expect(res.ok).toBe(true);
    expect(res.diagnose.some((d) => d.includes('with=item"'))).toBe(true);
  });

  it('liest den Lagerplatz aus der mitgelieferten Artikelbeschreibung', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      const nr = Number(new URL(url).searchParams.get('page'));
      return ANTWORT(
        seite(nr, 1, 1, (i) => ({
          id: i,
          itemId: i,
          number: '100234',
          item: { texts: [{ name1: 'Drehmaschine', description: '<p>Lagerplatz: Halle 2 Regal 4 Fach 1</p>' }] },
        })),
      );
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 1 });
    expect(res.befunde[0].code).toBe('H2R4F1');
    expect(res.befunde[0].quelle).toBe('Beschreibung');
    expect(res.befunde[0].name).toBe('Drehmaschine');
  });

  it('lädt Beschreibungen einzeln nach, wenn die Liste keine mitliefert', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (url.includes('/descriptions')) return ANTWORT([{ lang: 'de', description: 'Lagerplatz H3R2F5' }]);
      const nr = Number(new URL(url).searchParams.get('page'));
      return ANTWORT(seite(nr, 1, 1, (i) => ({ id: i, itemId: 500 + i, number: '100234' })));
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const ohne = await scanneLagerplaetze({ proSeite: 1 });
    expect(ohne.befunde[0].status).toBe('kein-treffer');
    expect(ohne.diagnose.some((d) => d.includes('Beschreibungen nachladen'))).toBe(true);

    const mit = await scanneLagerplaetze({ proSeite: 1, texteNachladen: true });
    expect(mit.befunde[0].code).toBe('H3R2F5');
    expect(mit.diagnose.some((d) => d.includes('nachgeladen'))).toBe(true);
  });

  it('gibt bei einem API-Fehler die bereits gelesenen Befunde zurück', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      const nr = Number(new URL(url).searchParams.get('page'));
      if (nr >= 2) return ANTWORT({ error: 'kaputt' }, 500);
      return ANTWORT(seite(nr, 1, 5, (i) => ({ id: i, itemId: i, number: `H1R1A${i}` })));
    });

    const { scanneLagerplaetze } = await import('./lagerplatz-scan');
    const res = await scanneLagerplaetze({ proSeite: 1, maxSeiten: 5 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/HTTP 500/);
    expect(res.befunde).toHaveLength(1);
    expect(res.naechsteSeite).toBe(2);
  });
});
