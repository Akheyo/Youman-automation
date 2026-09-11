/**
 * Sichert den Zwischenspeicher der Lagerort-Liste.
 *
 * Der Fehler, der repariert wird: Jeder Teilaufruf eines Buchungslaufs las
 * die ganze Liste neu — bei 13.000 Lagerorten 53 Seiten, mal 170 Runden über
 * 9.000 Leseabfragen. Daran zog PlentyONE die Lesebremse ("short period read
 * limit reached") und der Lauf blieb stehen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ANTWORT = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Zählt, wie oft die Lagerort-Seiten wirklich abgefragt wurden. */
function attrappe(opts: { seiten?: number } = {}) {
  const seiten = opts.seiten ?? 2;
  const abrufe: string[] = [];
  const fetchMock = async (url: string) => {
    if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
    if (url.includes('/locations')) {
      abrufe.push(url);
      const seite = Number(new URL(url).searchParams.get('page') ?? 1);
      return ANTWORT({
        entries: [{ id: 1000 + seite, fullLabel: `H1/R7/EA F16-K0${seite}`, levelId: 5, statusKey: 'active', purposeKey: 'picking' }],
        lastPageNumber: seiten,
        isLastPage: seite >= seiten,
      });
    }
    return ANTWORT({ entries: [], isLastPage: true });
  };
  return { fetchMock, abrufe };
}

describe('ladeLagerorteGepuffert', () => {
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

  it('liest beim zweiten Aufruf nichts nach', async () => {
    const { fetchMock, abrufe } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { ladeLagerorteGepuffert } = await import('./lagerorte');

    const erst = await ladeLagerorteGepuffert(106);
    const zahl = abrufe.length;
    const zweit = await ladeLagerorteGepuffert(106);

    expect(erst.ausPuffer).toBe(false);
    expect(zweit.ausPuffer).toBe(true);
    expect(zweit.orte).toEqual(erst.orte);
    expect(abrufe.length).toBe(zahl);
  });

  it('liest neu, wenn die Liste zu alt ist', async () => {
    const { fetchMock, abrufe } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { ladeLagerorteGepuffert } = await import('./lagerorte');

    await ladeLagerorteGepuffert(106);
    const zahl = abrufe.length;
    const nochmal = await ladeLagerorteGepuffert(106, { maxAlterMs: 0 });

    expect(nochmal.ausPuffer).toBe(false);
    expect(abrufe.length).toBeGreaterThan(zahl);
  });

  it('hält Lager getrennt auseinander', async () => {
    const { fetchMock, abrufe } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { ladeLagerorteGepuffert } = await import('./lagerorte');

    await ladeLagerorteGepuffert(106);
    const anderes = await ladeLagerorteGepuffert(107);

    expect(anderes.ausPuffer).toBe(false);
    expect(abrufe.some((u) => u.includes('/warehouses/107/'))).toBe(true);
  });

  it('vergisst die Liste, wenn Lagerorte angelegt wurden', async () => {
    const { fetchMock, abrufe } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { ladeLagerorteGepuffert, leereLagerortPuffer } = await import('./lagerorte');

    await ladeLagerorteGepuffert(106);
    const zahl = abrufe.length;
    leereLagerortPuffer(106);
    const danach = await ladeLagerorteGepuffert(106);

    expect(danach.ausPuffer).toBe(false);
    expect(abrufe.length).toBeGreaterThan(zahl);
  });

  it('bündelt gleichzeitige Aufrufe zu einem einzigen Lesevorgang', async () => {
    const { fetchMock, abrufe } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { ladeLagerorteGepuffert } = await import('./lagerorte');

    const [a, b] = await Promise.all([ladeLagerorteGepuffert(106), ladeLagerorteGepuffert(106)]);

    expect(a.orte).toEqual(b.orte);
    // Zwei Seiten, einmal gelesen — nicht doppelt.
    expect(abrufe.length).toBe(2);
  });
});
