import { describe, expect, it } from 'vitest';
import { baueItem, bildDateiname, leseKonfig, leseStand, MAKE_STANDARD, offeneBilder, pruefe } from './kern';
import { etikettAnzahl, MAX_ETIKETTEN } from './etikett';
import { etikettBase64, grenzen, gtinAn, leseNummernkreis, leseVorlagen, versatzVon } from './gtin';
import { isValidEan13 } from '@/lib/plenty/ean';

describe('leseKonfig', () => {
  it('nimmt ohne Umgebung die Werte aus dem Make-Szenario', () => {
    const k = leseKonfig({});
    expect(k.ownerId).toBe(128);
    expect(k.kategorieId).toBe(2246);
    expect(k.ebayPresetId).toBe(30);
    expect(k.unitId).toBe(1);
    expect(k.flagOne).toBe(0);
    expect(k.flagTwo).toBe(0);
    expect(k.warehouseId).toBeNull();
  });

  it('übernimmt gesetzte Werte und lässt 0 bei Flags zu', () => {
    const k = leseKonfig({
      FOTOSTUDIO_OWNER_ID: '7',
      FOTOSTUDIO_CATEGORY_ID: '99',
      FOTOSTUDIO_FLAG_ONE: '3',
      FOTOSTUDIO_FLAG_TWO: '0',
      PLENTY_WAREHOUSE_ID: '1',
    });
    expect(k.ownerId).toBe(7);
    expect(k.kategorieId).toBe(99);
    expect(k.flagOne).toBe(3);
    expect(k.flagTwo).toBe(0);
    expect(k.warehouseId).toBe(1);
  });

  it('fällt bei Unsinn auf den Standard zurück statt 0 zu schicken', () => {
    const k = leseKonfig({ FOTOSTUDIO_CATEGORY_ID: 'abc', FOTOSTUDIO_OWNER_ID: '0' });
    expect(k.kategorieId).toBe(MAKE_STANDARD.kategorieId);
    expect(k.ownerId).toBe(MAKE_STANDARD.ownerId);
  });

  it('lässt die eBay-Vorlage abschalten', () => {
    expect(leseKonfig({ FOTOSTUDIO_EBAY_PRESET_ID: 'aus' }).ebayPresetId).toBeNull();
    expect(leseKonfig({ FOTOSTUDIO_EBAY_PRESET_ID: '0' }).ebayPresetId).toBeNull();
  });

  it('bevorzugt das Fotostudio-Lager vor dem allgemeinen', () => {
    expect(leseKonfig({ FOTOSTUDIO_WAREHOUSE_ID: '4', PLENTY_WAREHOUSE_ID: '1' }).warehouseId).toBe(4);
  });
});

describe('pruefe', () => {
  const basis = { zustand: 'gebraucht' as const, bestand: 1, gewichtKg: 2, fotos: 1, unterwegs: 0 };

  it('lässt einen vollständigen Artikel durch', () => {
    expect(pruefe(basis)).toEqual({ ok: true, hindernisse: [], hinweise: [] });
  });

  it('verlangt ein Foto', () => {
    expect(pruefe({ ...basis, fotos: 0 }).ok).toBe(false);
  });

  it('hält an, solange ein Foto noch hochlädt', () => {
    const p = pruefe({ ...basis, unterwegs: 2 });
    expect(p.ok).toBe(false);
    expect(p.hindernisse.join()).toContain('2 Fotos');
  });

  it('macht ein fehlendes Gewicht zum Hinweis, nicht zum Hindernis', () => {
    const p = pruefe({ ...basis, gewichtKg: null });
    expect(p.ok).toBe(true);
    expect(p.hinweise).toHaveLength(1);
  });
});

describe('baueItem', () => {
  const k = leseKonfig({});

  it('setzt die Stammwerte aus Make und legt inaktiv an', () => {
    const item = baueItem({ zustand: 'gebraucht', gewichtKg: null }, k, { plentyId: 5 });
    expect(item.ownerId).toBe(128);
    expect(item.ebayPresetId).toBe(30);
    expect(item.flagOne).toBe(0);
    expect(item.condition).toBe(1);
    expect(item.variations[0].variationCategories).toEqual([{ categoryId: 2246 }]);
    expect(item.variations[0].unit).toEqual({ unitId: 1, content: 1 });
    expect(item.variations[0].isActive).toBe(false);
    expect(item.variations[0].variationClients).toEqual([{ plentyId: 5 }]);
    expect(item.variations[0].weightG).toBeUndefined();
  });

  it('rechnet das Gewicht in Gramm', () => {
    const item = baueItem({ zustand: 'neu', gewichtKg: 2.5 }, k, { plentyId: 0 });
    expect(item.variations[0].weightG).toBe(2500);
    expect(item.variations[0].weightNetG).toBe(2500);
    expect(item.condition).toBe(0);
  });

  it('hängt die EAN nur mit Barcode-Konfiguration an', () => {
    const ohne = baueItem({ zustand: 'neu', gewichtKg: null, ean: '2000000000015' }, k, { plentyId: 0 });
    expect(ohne.variations[0].variationBarcodes).toBeUndefined();
    const mit = baueItem({ zustand: 'neu', gewichtKg: null, ean: '2000000000015' }, k, {
      plentyId: 0,
      eanBarcodeId: 2,
    });
    expect(mit.variations[0].variationBarcodes).toEqual([{ barcodeId: 2, code: '2000000000015' }]);
  });

  it('lässt eine abgeschaltete eBay-Vorlage weg', () => {
    const item = baueItem({ zustand: 'neu', gewichtKg: null }, { ...k, ebayPresetId: null }, { plentyId: 0 });
    expect('ebayPresetId' in item).toBe(false);
  });
});

describe('Stand und offene Bilder', () => {
  it('liest kaputten Stand als leer', () => {
    expect(leseStand(null).itemId).toBeNull();
    expect(leseStand({ itemId: 'x', bilder: { a: 'b' } }).bilder).toEqual({});
  });

  it('liefert nur hochgeladene, noch nicht übertragene Bilder in Reihenfolge', () => {
    const stand = leseStand({ itemId: 1, variationId: 2, bilder: { b: 10 } });
    const bilder = [
      { id: 'c', position: 2, hochgeladen: true },
      { id: 'a', position: 0, hochgeladen: true },
      { id: 'b', position: 1, hochgeladen: true },
      { id: 'd', position: 3, hochgeladen: false },
    ];
    expect(offeneBilder(bilder, stand).map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('benennt Bilder nach Artikelnummer und Position', () => {
    expect(bildDateiname(42, 0, 'x/0-detail.JPG')).toBe('fotostudio-42-1.jpg');
    expect(bildDateiname(42, 3, 'x/ohne')).toBe('fotostudio-42-4.jpg');
  });
});

describe('Etiketten', () => {
  it('druckt eins je Stück', () => {
    expect(etikettAnzahl(5)).toBe(5);
    expect(etikettAnzahl(0)).toBe(1);
    expect(etikettAnzahl(null)).toBe(1);
    expect(etikettAnzahl(5000)).toBe(MAX_ETIKETTEN);
  });
});

describe('Nummernkreis', () => {
  const kreis = leseNummernkreis({ FOTOSTUDIO_GTIN_START: '426012345000', FOTOSTUDIO_GTIN_ANZAHL: '1000' })!;

  it('liest Start (12 Stellen) und Anzahl', () => {
    expect(kreis).toEqual({ basis: 426012345000, anzahl: 1000 });
  });

  it('nimmt auch die 13-stellige Start-GTIN mit Prüfziffer', () => {
    expect(leseNummernkreis({ FOTOSTUDIO_GTIN_START: '4260123450003', FOTOSTUDIO_GTIN_ANZAHL: '10' })?.basis).toBe(426012345000);
  });

  it('ist ohne Angaben aus', () => {
    expect(leseNummernkreis({})).toBeNull();
    expect(leseNummernkreis({ FOTOSTUDIO_GTIN_START: '123', FOTOSTUDIO_GTIN_ANZAHL: '5' })).toBeNull();
    expect(leseNummernkreis({ FOTOSTUDIO_GTIN_START: '426012345000', FOTOSTUDIO_GTIN_ANZAHL: '0' })).toBeNull();
  });

  it('erzeugt gültige GTINs innerhalb des Kreises', () => {
    const erste = gtinAn(kreis, 0)!;
    expect(erste.slice(0, 12)).toBe('426012345000');
    expect(isValidEan13(erste)).toBe(true);
    expect(gtinAn(kreis, 999)!.slice(0, 12)).toBe('426012345999');
    expect(gtinAn(kreis, 1000)).toBeNull();
    expect(gtinAn(kreis, -1)).toBeNull();
  });

  it('findet die Position einer GTIN wieder', () => {
    expect(versatzVon(kreis, gtinAn(kreis, 42))).toBe(42);
    expect(versatzVon(kreis, '2000000104812')).toBeNull();
    expect(versatzVon(kreis, null)).toBeNull();
  });

  it('liefert erste und letzte GTIN für die Datenbankabfrage', () => {
    const g = grenzen(kreis);
    expect(g.erste < g.letzte).toBe(true);
    expect(versatzVon(kreis, g.letzte)).toBe(999);
  });
});

describe('Plenty-Etikett', () => {
  const pdf = 'JVBERi0xLjQKJ';

  it('nimmt nacktes base64, JSON-String, Array und Objekt', () => {
    expect(etikettBase64(pdf)).toBe(pdf);
    expect(etikettBase64(JSON.stringify(pdf))).toBe(pdf);
    expect(etikettBase64(JSON.stringify([pdf]))).toBe(pdf);
    expect(etikettBase64(JSON.stringify({ content: pdf }))).toBe(pdf);
    expect(etikettBase64(`data:application/pdf;base64,${pdf}`)).toBe(pdf);
  });

  it('lehnt alles ab, was kein PDF ist', () => {
    expect(etikettBase64('{"error":"label not found"}')).toBeNull();
    expect(etikettBase64('')).toBeNull();
    expect(etikettBase64(null)).toBeNull();
  });

  it('liest Vorlagen in verschiedenen Hüllen', () => {
    expect(leseVorlagen([{ id: 3, name: 'Regal 57x32' }])).toEqual([{ id: 3, name: 'Regal 57x32' }]);
    expect(leseVorlagen({ entries: [{ labelId: 4, title: 'Klein' }] })).toEqual([{ id: 4, name: 'Klein' }]);
    expect(leseVorlagen({ 5: 'Groß' })).toEqual([{ id: 5, name: 'Groß' }]);
    expect(leseVorlagen('quatsch')).toEqual([]);
  });
});
