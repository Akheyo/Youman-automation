import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { leseKonfig, LEERER_STAND } from './kern';
import { gtinAn, leseNummernkreis } from './gtin';
import type { PlentyConfig } from '@/lib/plenty/client';

// Plenty wird ersetzt, nicht befragt: Geprüft wird, was die App bei belegten
// Nummern, Fehlern und Wiederholungen tut — das lässt sich gegen ein echtes
// Plenty nicht gezielt herstellen.
const plentyJson = vi.fn();
const plentyGet = vi.fn();
vi.mock('@/lib/plenty/client', () => ({
  aktuelleConfig: async () => cfg,
  plentyConfigured: () => true,
  plentyJson: (...a: unknown[]) => plentyJson(...a),
  plentyGet: (...a: unknown[]) => plentyGet(...a),
  plentyToken: async () => 'token',
}));

const cfg: PlentyConfig = {
  baseUrl: 'https://test.plenty',
  user: 'u',
  password: 'p',
  plentyId: 0,
  projekteCategoryId: null,
  eanBarcodeId: 7,
  eanPrefix: '20',
  invoicePropertyId: null,
  invoicePropertyName: '',
  uiUpload: false,
};

const { artikelAnlegen, etikettVonPlenty, vervielfachen } = await import('./plenty');

const kreis = leseNummernkreis({ FOTOSTUDIO_GTIN_START: '426012345000', FOTOSTUDIO_GTIN_ANZAHL: '100' })!;
const konfig = { ...leseKonfig({}), warehouseId: 1 };
const eingabe = { nummer: 5, zustand: 'gebraucht' as const, bestand: 3, gewichtKg: 1.5, startVersatz: 10 };

function leer() {
  return { ...LEERER_STAND, bilder: {}, offen: [] };
}

beforeEach(() => {
  plentyJson.mockReset();
  plentyGet.mockReset();
  plentyJson.mockImplementation(async (methode: string, pfad: string) => {
    if (methode === 'POST' && pfad === '/rest/items') return { id: 900, variations: [{ id: 901, isMain: true }] };
    return {};
  });
});

describe('artikelAnlegen', () => {
  it('legt an, nimmt die nächste freie Nummer aus dem Kreis und bucht den Bestand', async () => {
    // Position 10 ist in Plenty schon vergeben (z. B. per Knopf), 11 ist frei.
    plentyGet.mockImplementation(async (pfad: string) =>
      pfad.includes(gtinAn(kreis, 10)!) ? { totalsCount: 1 } : { totalsCount: 0 },
    );

    const { stand, fehler } = await artikelAnlegen(eingabe, leer(), konfig, kreis, cfg);

    expect(fehler).toBeNull();
    expect(stand.itemId).toBe(900);
    expect(stand.variationId).toBe(901);
    expect(stand.ean).toBe(gtinAn(kreis, 11));
    expect(stand.eanQuelle).toBe('nummernkreis');
    expect(stand.bestandGebucht).toBe(true);

    const anlage = plentyJson.mock.calls.find(([, p]) => p === '/rest/items')!;
    expect(anlage[2].variations[0].variationBarcodes).toBeUndefined();
    expect(anlage[2].ownerId).toBe(128);

    const barcode = plentyJson.mock.calls.find(([, p]) => String(p).endsWith('/variation_barcodes'))!;
    expect(barcode[1]).toBe('/rest/items/900/variations/901/variation_barcodes');
    expect(barcode[2]).toEqual({ barcodeId: 7, variationId: 901, code: gtinAn(kreis, 11) });

    const bestand = plentyJson.mock.calls.find(([m]) => m === 'PUT')!;
    expect(bestand[2]).toEqual({ variationId: 901, quantity: 3, reasonId: 501 });
  });

  it('springt weiter, wenn Plenty die Nummer beim Anhängen als doppelt ablehnt', async () => {
    plentyGet.mockResolvedValue({ totalsCount: 0 });
    let erster = true;
    plentyJson.mockImplementation(async (methode: string, pfad: string) => {
      if (pfad === '/rest/items') return { id: 900, variations: [{ id: 901, isMain: true }] };
      if (String(pfad).endsWith('/variation_barcodes') && erster) {
        erster = false;
        throw new Error('HTTP 422: The combination of code and barcode ID must be unique');
      }
      return {};
    });
    const { stand } = await artikelAnlegen(eingabe, leer(), konfig, kreis, cfg);
    expect(stand.ean).toBe(gtinAn(kreis, 11));
  });

  it('legt beim zweiten Anlauf keinen zweiten Artikel an und vergibt keine zweite EAN', async () => {
    const vorher = { ...leer(), itemId: 900, variationId: 901, ean: gtinAn(kreis, 10), eanQuelle: 'nummernkreis' as const, bestandGebucht: true };
    const { stand } = await artikelAnlegen(eingabe, vorher, konfig, kreis, cfg);
    expect(stand.ean).toBe(gtinAn(kreis, 10));
    expect(plentyJson).not.toHaveBeenCalled();
    expect(plentyGet).not.toHaveBeenCalled();
  });

  it('meldet einen aufgebrauchten Kreis, statt eine fremde Nummer zu nehmen', async () => {
    plentyGet.mockResolvedValue({ totalsCount: 0 });
    const { stand } = await artikelAnlegen({ ...eingabe, startVersatz: 100 }, leer(), konfig, kreis, cfg);
    expect(stand.ean).toBeNull();
    expect(stand.offen.join()).toContain('aufgebraucht');
  });

  it('nimmt ohne Kreis den internen Bereich und sagt es', async () => {
    const { stand } = await artikelAnlegen(eingabe, leer(), konfig, null, cfg);
    expect(stand.ean?.startsWith('20')).toBe(true);
    expect(stand.eanQuelle).toBe('intern');
    expect(stand.offen.join()).toContain('FOTOSTUDIO_GTIN_START');
  });

  it('vergibt ohne Barcode-Konfiguration keine EAN', async () => {
    const { stand } = await artikelAnlegen(eingabe, leer(), konfig, kreis, { ...cfg, eanBarcodeId: null });
    expect(stand.ean).toBeNull();
    expect(stand.offen.join()).toContain('PLENTY_EAN_BARCODE_ID');
  });
});

describe('Etikett aus Plenty', () => {
  async function einSeitenPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.addPage([161, 91]); // 57 × 32 mm
    return doc.save();
  }

  it('holt das base64-PDF aus der Vorlage und macht eine Seite je Stück daraus', async () => {
    const pdf = await einSeitenPdf();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([Buffer.from(pdf).toString('base64')]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const einzeln = await etikettVonPlenty(900, 901, 4, cfg);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://test.plenty/rest/items/900/variations/901/labels');
    expect(JSON.parse(String(init.body))).toEqual({ labelId: 4 });

    const drei = await PDFDocument.load(await vervielfachen(einzeln, 3));
    expect(drei.getPageCount()).toBe(3);
    vi.unstubAllGlobals();
  });

  it('sagt deutlich, wenn Plenty kein PDF liefert', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"label not found"}', { status: 200 })));
    await expect(etikettVonPlenty(900, 901, 4, cfg)).rejects.toThrow('kein PDF');
    vi.unstubAllGlobals();
  });
});
