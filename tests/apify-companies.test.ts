import { afterEach, describe, expect, it, vi } from 'vitest';
import { findCompaniesApify } from '@/lib/felix/apify-companies';

const TOKEN = 'apify_api_test';

function mockFetch(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('findCompaniesApify', () => {
  it('rejects an empty area or industry without calling Apify', async () => {
    const fn = mockFetch([]);
    const r = await findCompaniesApify({ area: '', industry: 'Onlineshop' }, TOKEN);
    expect(r.companies).toEqual([]);
    expect(r.error).toMatch(/Ort und Branche/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('maps an Actor result onto CompanyResult', async () => {
    mockFetch([
      {
        placeId: 'abc123',
        title: 'Muster Onlinehandel GmbH',
        address: 'Musterstr. 1, 12345 Musterstadt',
        phone: '+49 30 1234567',
        website: 'https://muster-shop.de',
        categoryName: 'Onlineshop',
        categories: ['Onlineshop', 'Versandhandel'],
        location: { lat: 52.5, lng: 13.4 },
      },
    ]);
    const r = await findCompaniesApify({ area: 'Berlin', industry: 'Onlineshop' }, TOKEN);
    expect(r.error).toBeUndefined();
    expect(r.companies).toHaveLength(1);
    const c = r.companies[0]!;
    expect(c).toMatchObject({
      id: 'apify/abc123',
      name: 'Muster Onlinehandel GmbH',
      address: 'Musterstr. 1, 12345 Musterstadt',
      phone: '+49 30 1234567',
      website: 'https://muster-shop.de',
      hasWebsite: true,
      lat: 52.5,
      lng: 13.4,
    });
    // Doppelte Kategorien duerfen die Beschreibung nicht aufblaehen
    expect(c.descriptors).toEqual(['Onlineshop', 'Versandhandel']);
  });

  it('assembles the address from parts when the Actor omits the full line', async () => {
    mockFetch([
      { title: 'Teil-Adresse GmbH', street: 'Hauptweg 7', postalCode: '80331', city: 'München' },
    ]);
    const r = await findCompaniesApify({ area: 'München', industry: 'Onlineshop' }, TOKEN);
    expect(r.companies[0]!.address).toBe('Hauptweg 7, 80331 München');
    expect(r.companies[0]!.hasWebsite).toBe(false);
  });

  it('drops closed places and honours without_website', async () => {
    mockFetch([
      { title: 'Geschlossen GmbH', permanentlyClosed: true },
      { title: 'Mit Website GmbH', website: 'https://a.de' },
      { title: 'Ohne Website GmbH' },
    ]);
    const r = await findCompaniesApify(
      { area: 'Wien', industry: 'Onlineshop', without_website: true, country: 'at' },
      TOKEN,
    );
    expect(r.companies.map((c) => c.name)).toEqual(['Ohne Website GmbH']);
  });

  it('caps limit so a stray value cannot run up the Apify bill', async () => {
    const fn = mockFetch([]);
    await findCompaniesApify({ area: 'Zürich', industry: 'Onlineshop', limit: 5000 }, TOKEN);
    const body = JSON.parse((fn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.maxCrawledPlacesPerSearch).toBe(60);
    expect(body.countryCode).toBe('de');
  });

  it('passes the country through to the Actor', async () => {
    const fn = mockFetch([]);
    await findCompaniesApify({ area: 'Basel', industry: 'Onlineshop', country: 'ch' }, TOKEN);
    const body = JSON.parse((fn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.countryCode).toBe('ch');
  });

  it('surfaces the Apify error message and a hint on 401', async () => {
    mockFetch({ error: { message: 'User was not found or authentication token is not valid' } }, { status: 401 });
    const r = await findCompaniesApify({ area: 'Berlin', industry: 'Onlineshop' }, TOKEN);
    expect(r.companies).toEqual([]);
    expect(r.error).toContain('401');
    expect(r.error).toContain('authentication token is not valid');
    expect(r.error).toMatch(/APIFY_TOKEN/);
  });

  it('reports exhausted credit on 402', async () => {
    mockFetch({ error: { message: 'Monthly usage hard limit exceeded' } }, { status: 402 });
    const r = await findCompaniesApify({ area: 'Berlin', industry: 'Onlineshop' }, TOKEN);
    expect(r.error).toMatch(/Guthaben/);
  });

  it('returns an error instead of throwing when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const r = await findCompaniesApify({ area: 'Berlin', industry: 'Onlineshop' }, TOKEN);
    expect(r.companies).toEqual([]);
    expect(r.error).toMatch(/ECONNREFUSED/);
  });

  it('handles a non-array payload without throwing', async () => {
    mockFetch({ unexpected: true });
    const r = await findCompaniesApify({ area: 'Berlin', industry: 'Onlineshop' }, TOKEN);
    expect(r.companies).toEqual([]);
    expect(r.error).toBeUndefined();
  });
});
