import { describe, expect, it } from 'vitest';
import { baueItem, bildDateiname, leseKonfig, leseStand, MAKE_STANDARD, offeneBilder, pruefe } from './kern';
import { ean13Balken, ean13Module } from './ean13-muster';
import { etikettAnzahl, formatNachId, MAX_ETIKETTEN, STANDARD_FORMAT } from './etikett';

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

describe('EAN-13-Muster', () => {
  it('erzeugt 95 Module mit Rand- und Mittelzeichen', () => {
    const m = ean13Module('4006381333931');
    expect(m).toHaveLength(95);
    expect(m.startsWith('101')).toBe(true);
    expect(m.endsWith('101')).toBe(true);
    expect(m.slice(45, 50)).toBe('01010');
  });

  it('kodiert die erste Ziffer über die Parität (bekanntes Beispiel)', () => {
    // 4006381333931: linke Hälfte LGLLGG → erste Ziffer 0 als L = 0001101
    expect(ean13Module('4006381333931').slice(3, 10)).toBe('0001101');
  });

  it('weist ungültige Prüfziffern ab', () => {
    expect(() => ean13Module('4006381333932')).toThrow();
  });

  it('fasst Striche zusammen, Gesamtbreite stimmt', () => {
    const balken = ean13Balken('4006381333931');
    const schwarz = balken.reduce((s, [, b]) => s + b, 0);
    expect(schwarz).toBe(ean13Module('4006381333931').split('').filter((c) => c === '1').length);
  });
});

describe('Etiketten', () => {
  it('druckt eins je Stück', () => {
    expect(etikettAnzahl(5)).toBe(5);
    expect(etikettAnzahl(0)).toBe(1);
    expect(etikettAnzahl(null)).toBe(1);
    expect(etikettAnzahl(5000)).toBe(MAX_ETIKETTEN);
  });

  it('fällt bei unbekanntem Format auf den Standard zurück', () => {
    expect(formatNachId('quatsch')).toBe(STANDARD_FORMAT);
    expect(formatNachId('62x29').breiteMm).toBe(62);
  });
});
