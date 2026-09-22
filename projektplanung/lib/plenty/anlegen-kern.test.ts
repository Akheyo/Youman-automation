import { describe, expect, it } from 'vitest';
import {
  baueItemPayload,
  baueNotiz,
  bauePreise,
  baueTexte,
  leseVersandprofile,
  pruefeBereitschaft,
  technischeDaten,
  versandprofilId,
  type ArtikelEingabe,
} from './anlegen-kern';
import type { Erkennung } from '@/lib/erfassung/erkennung';
import type { Listing } from '@/lib/listing/texte';

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
      metaDescription: 'Gebrauchter Akkuschrauber, sofort ab Lager.',
      keywords: ['akkuschrauber', 'bosch'],
      urlPfad: 'bosch-gsr-18v-55-akkuschrauber',
    }),
    ...teil,
  };
}

describe('leseVersandprofile', () => {
  it('liest die Zuordnung aus der Umgebung', () => {
    const p = leseVersandprofile('7.90=6,9.90=7,spedition=11');
    expect(p.get('7.90')).toBe(6);
    expect(p.get('spedition')).toBe(11);
  });

  it('ignoriert Unsinn statt zu raten', () => {
    const p = leseVersandprofile('7.90=,=7,kaputt,9.90=0');
    expect(p.size).toBe(0);
  });

  it('kommt mit leerer Angabe zurecht', () => {
    expect(leseVersandprofile(undefined).size).toBe(0);
  });
});

describe('versandprofilId', () => {
  const profile = leseVersandprofile('7.90=6,14.90=8,spedition=11');

  it('findet das Profil zum Betrag', () => {
    expect(versandprofilId(profile, 7.9, false)).toBe(6);
    expect(versandprofilId(profile, 14.9, false)).toBe(8);
  });

  it('nimmt bei Spedition das Speditionsprofil', () => {
    expect(versandprofilId(profile, null, true)).toBe(11);
  });

  it('liefert nichts, wenn der Betrag nicht hinterlegt ist', () => {
    expect(versandprofilId(profile, 19.9, false)).toBeNull();
  });

  it('liefert ohne Kosten nichts', () => {
    expect(versandprofilId(profile, null, false)).toBeNull();
  });
});

describe('technischeDaten', () => {
  it('baut eine Liste aus den Merkmalen', () => {
    expect(technischeDaten(erkennung())).toContain('<li>Spannung: 18 V</li>');
  });

  it('nimmt Masse, Baujahr und Seriennummer mit', () => {
    const t = technischeDaten(
      erkennung({ masseCm: { laenge: 30, breite: 10, hoehe: 25 }, baujahr: '2018', seriennummer: 'X1' }),
    );
    expect(t).toContain('30 x 10 x 25 cm');
    expect(t).toContain('Baujahr: 2018');
    expect(t).toContain('Seriennummer: X1');
  });

  it('liefert nichts, wenn es nichts gibt', () => {
    expect(technischeDaten(erkennung({ merkmale: [] }))).toBe('');
  });
});

describe('baueTexte', () => {
  it('legt die drei eBay-Titel in name1 bis name3', () => {
    const t = baueTexte({
      listing,
      erkennung: erkennung(),
      metaDescription: 'M',
      keywords: ['a'],
      urlPfad: 'p',
    });
    expect(t.name1).toBe(listing.titel1);
    expect(t.name2).toBe(listing.titel2);
    expect(t.name3).toBe(listing.titel3);
  });

  it('nimmt die Produktkarte als Beschreibung, wenn es sie gibt', () => {
    const t = baueTexte({
      listing,
      erkennung: erkennung(),
      produktkarte: '<h1>Produktkarte</h1>',
      metaDescription: 'M',
      keywords: [],
      urlPfad: 'p',
    });
    expect(t.description).toBe('<h1>Produktkarte</h1>');
  });

  it('faellt ohne Produktkarte auf die Beschreibung zurueck', () => {
    const t = baueTexte({ listing, erkennung: erkennung(), metaDescription: 'M', keywords: [], urlPfad: 'p' });
    expect(t.description).toBe(listing.beschreibung);
  });
});

describe('bauePreise', () => {
  it('setzt beide Preise', () => {
    expect(bauePreise(49, 46, { ebay: 1, webshop: 2 })).toEqual([
      { salesPriceId: 1, price: 49 },
      { salesPriceId: 2, price: 46 },
    ]);
  });

  it('laesst eine fehlende Preisliste weg, statt umzulenken', () => {
    // Ein eBay-Preis im Webshop waere um fuenf Prozent zu hoch und faellt
    // niemandem auf.
    expect(bauePreise(49, 46, { ebay: 1, webshop: null })).toEqual([{ salesPriceId: 1, price: 49 }]);
  });

  it('setzt keinen Preis von null', () => {
    expect(bauePreise(null, null, { ebay: 1, webshop: 2 })).toEqual([]);
  });
});

describe('pruefeBereitschaft', () => {
  it('laesst einen vollstaendigen Artikel durch', () => {
    const b = pruefeBereitschaft(eingabe());
    expect(b.bereit).toBe(true);
    expect(b.hindernisse).toHaveLength(0);
  });

  it('haelt einen Artikel ohne Kategorie auf', () => {
    expect(pruefeBereitschaft(eingabe({ kategorieId: null })).bereit).toBe(false);
  });

  it('haelt einen Artikel ohne Preis auf', () => {
    // Sonst stuende er in Plenty mit 0,00 Euro.
    const b = pruefeBereitschaft(eingabe({ preisEbay: null }));
    expect(b.bereit).toBe(false);
    expect(b.hindernisse.join(' ')).toContain('0,00');
  });

  it('haelt einen Artikel ohne Bestand auf', () => {
    expect(pruefeBereitschaft(eingabe({ bestand: 0 })).bereit).toBe(false);
  });

  it('macht aus fehlendem Gewicht einen Hinweis, keine Sperre', () => {
    const b = pruefeBereitschaft(eingabe({ gewichtKg: null, versandkosten: null }));
    expect(b.bereit).toBe(true);
    expect(b.hinweise.join(' ')).toContain('Gewicht');
  });

  it('weist auf das fehlende Typenschild hin', () => {
    const erk = erkennung({ typenschildGefunden: false });
    const b = pruefeBereitschaft(eingabe({ erkennung: erk }));
    expect(b.hinweise.join(' ')).toContain('Typenschild');
  });

  it('merkt an, wenn nur Spedition geht', () => {
    const b = pruefeBereitschaft(eingabe({ gewichtKg: 45, spedition: true, versandkosten: null }));
    expect(b.hinweise.join(' ')).toContain('Spedition');
  });
});

describe('baueItemPayload', () => {
  const konf = { plentyId: 0, eanBarcodeId: 3, salesPriceEbayId: 1, salesPriceWebshopId: 2 };

  it('legt den Artikel immer inaktiv an', () => {
    // Die einzige Sicherung dagegen, dass ein falsch erkannter Artikel
    // sofort auf eBay steht.
    expect(baueItemPayload(eingabe(), konf).variations[0].isActive).toBe(false);
  });

  it('haengt Kategorie, EAN und Preise an die Variante', () => {
    const v = baueItemPayload(eingabe(), konf).variations[0];
    expect(v.variationCategories).toEqual([{ categoryId: 42 }]);
    expect(v.variationBarcodes).toEqual([{ barcodeId: 3, code: '2000000000015' }]);
    expect(v.variationSalesPrices).toHaveLength(2);
  });

  it('rechnet das Gewicht in Gramm um', () => {
    const v = baueItemPayload(eingabe({ gewichtKg: 2.4 }), konf).variations[0];
    expect(v.weightG).toBe(2400);
  });

  it('laesst das Gewicht weg, wenn keines bekannt ist', () => {
    const v = baueItemPayload(eingabe({ gewichtKg: null }), konf).variations[0];
    expect(v.weightG).toBeUndefined();
  });

  it('laesst den Barcode weg, wenn keine Barcode-ID konfiguriert ist', () => {
    const v = baueItemPayload(eingabe(), { ...konf, eanBarcodeId: null }).variations[0];
    expect(v.variationBarcodes).toBeUndefined();
  });

  it('setzt den Zustandsschluessel', () => {
    expect(baueItemPayload(eingabe({ zustand: 'gebraucht' }), konf).condition).toBe(1);
    expect(baueItemPayload(eingabe({ zustand: 'neu' }), konf).condition).toBe(0);
  });

  it('uebernimmt die Zolltarifnummer nur, wenn es eine gibt', () => {
    expect(baueItemPayload(eingabe(), konf).variations[0].customsTariffNumber).toBeUndefined();
    expect(baueItemPayload(eingabe({ zolltarifnummer: '84672100' }), konf).variations[0].customsTariffNumber).toBe(
      '84672100',
    );
  });
});

describe('baueNotiz', () => {
  it('haelt Preis und Herleitung fest', () => {
    const e = eingabe({ herleitung: 'Preisfindung:\n· Exaktes Produkt → 3 Angebote' });
    const n = baueNotiz(e, pruefeBereitschaft(e));
    expect(n).toContain('eBay: 49.00 EUR');
    expect(n).toContain('Webshop: 46.00 EUR');
    expect(n).toContain('Exaktes Produkt');
  });

  it('listet auf, was noch offen ist', () => {
    const e = eingabe({ gewichtKg: null, versandkosten: null });
    const n = baueNotiz(e, pruefeBereitschaft(e));
    expect(n).toContain('Offen:');
    expect(n).toContain('Gewicht');
  });
});
