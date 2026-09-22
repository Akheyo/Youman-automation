import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const plentyJson = vi.fn();
vi.mock('./client', () => ({
  aktuelleConfig: async () => ({ baseUrl: 'https://test.plenty', plentyId: 0 }),
  plentyJson: (...args: unknown[]) => plentyJson(...args),
  plentyToken: async () => 'token',
}));

const { MAX_BILD_BYTES, MAX_BILDER, ladeBild, uebertrageBilder } = await import('./bilder');

function quellbild(nummer: number) {
  return {
    url: `https://cdn.example.de/${nummer}.jpg`,
    dateiname: `artikel-${nummer}.jpg`,
    altText: `Artikel, Ansicht ${nummer}`,
    position: nummer - 1,
  };
}

const echteFetch = global.fetch;

function antworteMitBytes(bytes: number) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(bytes),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  plentyJson.mockReset();
  plentyJson.mockResolvedValue({ id: 77 });
  antworteMitBytes(1024);
});
afterEach(() => {
  global.fetch = echteFetch;
  vi.restoreAllMocks();
});

describe('ladeBild', () => {
  it('wirft bei einem leeren Bild', async () => {
    antworteMitBytes(0);
    await expect(ladeBild('https://cdn.example.de/1.jpg')).rejects.toThrow(/leer/);
  });

  it('wirft bei einem zu grossen Bild', async () => {
    antworteMitBytes(MAX_BILD_BYTES + 1);
    await expect(ladeBild('https://cdn.example.de/1.jpg')).rejects.toThrow(/groß/);
  });

  it('wirft, wenn das Bild nicht abrufbar ist', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    await expect(ladeBild('https://cdn.example.de/1.jpg')).rejects.toThrow(/404/);
  });
});

describe('uebertrageBilder', () => {
  it('uebertraegt alle Bilder', async () => {
    const r = await uebertrageBilder(555, 999, [quellbild(1), quellbild(2)]);
    expect(r.uebertragen).toBe(2);
    expect(r.imageIds).toEqual([77, 77]);
    expect(r.fehler).toHaveLength(0);
  });

  it('setzt Alt-Text und ordnet der Variante zu', async () => {
    await uebertrageBilder(555, 999, [quellbild(1)]);
    const pfade = plentyJson.mock.calls.map((c) => String(c[1]));
    expect(pfade.some((p) => p.includes('/images/upload'))).toBe(true);
    expect(pfade.some((p) => p.includes('/names'))).toBe(true);
    expect(pfade.some((p) => p.includes('/variation_images'))).toBe(true);
  });

  it('laesst ein gescheitertes Bild die anderen nicht mitnehmen', async () => {
    // Ein Artikel mit vier von fuenf Bildern ist brauchbar; einer ohne nicht.
    let aufruf = 0;
    global.fetch = vi.fn(async () => {
      aufruf += 1;
      if (aufruf === 1) return { ok: false, status: 500 } as never;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1024) } as never;
    }) as unknown as typeof fetch;

    const r = await uebertrageBilder(555, 999, [quellbild(1), quellbild(2)]);
    expect(r.uebertragen).toBe(1);
    expect(r.fehler).toHaveLength(1);
    expect(r.fehler[0].dateiname).toBe('artikel-1.jpg');
  });

  it('haelt das Bild oben, auch wenn der Alt-Text nicht durchgeht', async () => {
    plentyJson.mockImplementation(async (_m: string, pfad: string) => {
      if (String(pfad).includes('/names')) throw new Error('HTTP 403');
      return { id: 77 };
    });
    const r = await uebertrageBilder(555, 999, [quellbild(1)]);
    expect(r.uebertragen).toBe(1);
    expect(r.fehler[0].grund).toContain('Alt-Text');
  });

  it('meldet, wenn Plenty keine Bild-ID liefert', async () => {
    plentyJson.mockResolvedValue({});
    const r = await uebertrageBilder(555, 999, [quellbild(1)]);
    expect(r.uebertragen).toBe(0);
    expect(r.fehler[0].grund).toContain('Bild-ID');
  });

  it('haelt bei zu vielen Bildern an und sagt es', async () => {
    const viele = Array.from({ length: MAX_BILDER + 3 }, (_, i) => quellbild(i + 1));
    const r = await uebertrageBilder(555, 999, viele);
    expect(r.uebertragen).toBe(MAX_BILDER);
    expect(r.fehler.some((f) => f.grund.includes(`ersten ${MAX_BILDER}`))).toBe(true);
  });

  it('kommt ohne Bilder zurecht', async () => {
    const r = await uebertrageBilder(555, 999, []);
    expect(r.uebertragen).toBe(0);
    expect(r.fehler).toHaveLength(0);
  });
});
