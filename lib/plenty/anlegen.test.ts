import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Erkennung } from '@/lib/erfassung/erkennung';
import type { Listing } from '@/lib/listing/texte';
import { baueTexte, type ArtikelEingabe } from './anlegen-kern';

// Das Netz wird ersetzt, nicht befragt: Geprueft wird das Verhalten bei
// Teilfehlern, und das laesst sich gegen ein echtes Plenty nicht herstellen.
const plentyJson = vi.fn();
vi.mock('./client', () => ({
  aktuelleConfig: async () => ({
    baseUrl: 'https://test.plenty',
    user: 'u',
    password: 'p',
    plentyId: 0,
    projekteCategoryId: null,
    eanBarcodeId: 3,
    eanPrefix: '20',
    invoicePropertyId: null,
    invoicePropertyName: '',
    uiUpload: false,
  }),
  plentyConfigured: (cfg: { baseUrl?: string }) => Boolean(cfg?.baseUrl),
  plentyJson: (...args: unknown[]) => plentyJson(...args),
}));

const { legeArtikelAn } = await import('./anlegen');

function erkennung(teil: Partial<Erkennung> = {}): Erkennung {
  return {
    artikelTyp: 'Akkuschrauber',
    titel: 'Bosch GSR 18V-55 Akkuschrauber',
    hersteller: 'Bosch',
    modell: 'GSR 18V-55',
    modellnummer: '06019H5200',
    seriennummer: null,
    baujahr: null,
    zustand: 'gebraucht_spuren',
    schaeden: [],
    lieferumfang: [],
    merkmale: [{ name: 'Spannung', wert: '18 V' }],
    masseCm: null,
    typenschildGefunden: true,
    suchbegriffe: [],
    sicherheit: 'hoch',
    unsicherheiten: [],
    bilder: [],
    ...teil,
  };
}

const listing: Listing = {
  titel1: 'Bosch GSR 18V-55 Akkuschrauber',
  titel2: 'Bosch GSR 18V-55 Akkuschrauber gebraucht',
  titel3: 'Bosch GSR 18V-55 Akkuschrauber 18 V gebraucht',
  beschreibung: '<p>Gebrauchter Akkuschrauber.</p>',
  generisch: false,
};

function eingabe(teil: Partial<ArtikelEingabe> = {}): ArtikelEingabe {
  const erk = teil.erkennung ?? erkennung();
  return {
    listing,
    erkennung: erk,
    zustand: 'gebraucht',
    bestand: 1,
    kategorieId: 42,
    ean: '2000000000015',
    preisEbay: 49,
    preisWebshop: 46,
    gewichtKg: 2,
    versandkosten: 7.9,
    spedition: false,
    texte: baueTexte({
      listing,
      erkennung: erk,
      metaDescription: 'M',
      keywords: [],
      urlPfad: 'p',
    }),
    ...teil,
  };
}

const anlage = {
  clientId: 14616,
  salesPriceEbayId: 1,
  salesPriceWebshopId: 2,
  warehouseId: 7,
  marketIds: ['103.00'],
  versandprofile: new Map([['7.90', 6]]),
  sammelKategorieId: null,
};

beforeEach(() => {
  plentyJson.mockReset();
  plentyJson.mockResolvedValue({ id: 555, variations: [{ id: 999, isMain: true }] });
});
afterEach(() => vi.restoreAllMocks());

describe('legeArtikelAn', () => {
  it('legt den Artikel an und liefert die IDs', async () => {
    const r = await legeArtikelAn(eingabe(), { anlage });
    expect(r.ok).toBe(true);
    expect(r.itemId).toBe(555);
    expect(r.variationId).toBe(999);
  });

  it('legt den Artikel inaktiv an', async () => {
    await legeArtikelAn(eingabe(), { anlage });
    const [, pfad, koerper] = plentyJson.mock.calls[0];
    expect(pfad).toBe('/rest/items');
    expect((koerper as any).variations[0].isActive).toBe(false);
  });

  it('setzt inaktiv am Ende noch einmal ausdruecklich', async () => {
    await legeArtikelAn(eingabe(), { anlage });
    const letzter = plentyJson.mock.calls[plentyJson.mock.calls.length - 1];
    expect(letzter[0]).toBe('PUT');
    expect(letzter[2]).toEqual({ isActive: false });
  });

  it('verliert den Artikel nicht, wenn ein spaeterer Schritt scheitert', async () => {
    // Genau darum geht es: Ein halb angelegter Artikel, von dem niemand
    // weiss, ist das Schlimmste, was hier passieren kann.
    plentyJson
      .mockResolvedValueOnce({ id: 555, variations: [{ id: 999, isMain: true }] })
      .mockRejectedValueOnce(new Error('HTTP 403: keine Berechtigung'))
      .mockResolvedValue({});
    const r = await legeArtikelAn(eingabe(), { anlage });
    expect(r.ok).toBe(true);
    expect(r.itemId).toBe(555);
    expect(r.offen.join(' ')).toContain('403');
  });

  it('bricht ab, wenn schon der Artikel nicht entsteht', async () => {
    plentyJson.mockRejectedValue(new Error('HTTP 500'));
    const r = await legeArtikelAn(eingabe(), { anlage });
    expect(r.ok).toBe(false);
    expect(r.itemId).toBeNull();
    expect(r.fehler).toContain('HTTP 500');
  });

  it('bricht ab, wenn Plenty keine Varianten-ID liefert', async () => {
    plentyJson.mockResolvedValue({ id: 555, variations: [] });
    const r = await legeArtikelAn(eingabe(), { anlage });
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('Varianten-ID');
  });

  it('faengt einen unfertigen Artikel vor dem ersten Aufruf ab', async () => {
    const r = await legeArtikelAn(eingabe({ preisEbay: null }), { anlage });
    expect(r.ok).toBe(false);
    expect(plentyJson).not.toHaveBeenCalled();
    expect(r.fehler).toContain('anlagefähig');
  });

  it('ueberspringt das Versandprofil, wenn keines hinterlegt ist', async () => {
    const r = await legeArtikelAn(eingabe({ versandkosten: 19.9 }), { anlage });
    expect(r.offen.join(' ')).toContain('PLENTY_VERSANDPROFILE');
    expect(plentyJson.mock.calls.some((c) => String(c[1]).includes('item_shipping_profiles'))).toBe(false);
  });

  it('ueberspringt den Bestand ohne Lager', async () => {
    const r = await legeArtikelAn(eingabe(), { anlage: { ...anlage, warehouseId: null } });
    expect(r.offen.join(' ')).toContain('PLENTY_WAREHOUSE_ID');
  });

  it('merkt an, wenn keine Maerkte konfiguriert sind', async () => {
    const r = await legeArtikelAn(eingabe(), { anlage: { ...anlage, marketIds: [] } });
    expect(r.offen.join(' ')).toContain('PLENTY_MARKET_IDS');
  });

  it('nimmt die offenen Punkte aus der Bereitschaftspruefung mit', async () => {
    const r = await legeArtikelAn(eingabe({ gewichtKg: null, versandkosten: null }), { anlage });
    expect(r.offen.join(' ')).toContain('Gewicht');
  });

  it('schreibt die Herleitung in die Notiz', async () => {
    const r = await legeArtikelAn(eingabe({ herleitung: 'Preisfindung: eBay.de, 3 Angebote' }), { anlage });
    expect(r.notiz).toContain('eBay.de, 3 Angebote');
  });
});

describe('Mandant des angelegten Artikels', () => {
  it('nimmt den eigens gesetzten Mandanten, nicht den der Zugangsdaten', async () => {
    // Der Zugang gilt fuers ganze System; gelistet wird aber moeglicherweise
    // in einem anderen Shop. Steht dort der falsche Mandant, ist der Artikel
    // sauber angelegt und im Zielshop trotzdem unsichtbar.
    await legeArtikelAn(eingabe(), { anlage });
    const [, , koerper] = plentyJson.mock.calls[0];
    expect((koerper as any).variations[0].variationClients).toEqual([{ plentyId: 14616 }]);
  });

  it('faellt ohne eigene Angabe auf den Mandanten der Zugangsdaten zurueck', async () => {
    await legeArtikelAn(eingabe(), { anlage: { ...anlage, clientId: null } });
    const [, , koerper] = plentyJson.mock.calls[0];
    expect((koerper as any).variations[0].variationClients).toEqual([{ plentyId: 0 }]);
  });
});
