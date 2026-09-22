import { describe, expect, it } from 'vitest';
import {
  baueBreadcrumbList,
  baueFaqPage,
  baueImageObjects,
  baueMarkup,
  baueProduct,
  markupTag,
  type MarkupEingabe,
} from './schema-org';
import type { Erkennung } from '@/lib/erfassung/erkennung';

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

function eingabe(teil: Partial<MarkupEingabe> = {}): MarkupEingabe {
  return {
    erkennung: erkennung(),
    zustand: 'gebraucht',
    url: 'https://shop.example.de/bosch-gsr-18v-55',
    name: 'Bosch GSR 18V-55 Akkuschrauber',
    beschreibung: 'Gebrauchter Akkuschrauber, sofort ab Lager.',
    preis: 49,
    bestand: 1,
    generisch: false,
    ...teil,
  };
}

describe('baueProduct', () => {
  it('haengt Preis und Verfuegbarkeit als Offer an', () => {
    const p = baueProduct(eingabe()) as any;
    expect(p.offers.price).toBe('49.00');
    expect(p.offers.priceCurrency).toBe('EUR');
    expect(p.offers.availability).toBe('https://schema.org/InStock');
  });

  it('laesst das Offer weg, wenn kein Preis feststeht', () => {
    // Ohne Preis ist der Artikel nicht verkaufsfertig — ein Offer ohne Preis
    // waere eine fehlerhafte Auszeichnung.
    const p = baueProduct(eingabe({ preis: null })) as any;
    expect(p.offers).toBeUndefined();
  });

  it('meldet ausverkauft, wenn der Bestand leer ist', () => {
    const p = baueProduct(eingabe({ bestand: 0 })) as any;
    expect(p.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('setzt den Zustand auf UsedCondition', () => {
    const p = baueProduct(eingabe()) as any;
    expect(p.offers.itemCondition).toBe('https://schema.org/UsedCondition');
  });

  it('unterscheidet defekt von gebraucht', () => {
    const p = baueProduct(eingabe({ zustand: 'defekt' })) as any;
    expect(p.offers.itemCondition).toBe('https://schema.org/DamagedCondition');
  });

  it('nennt Marke, Modell und MPN', () => {
    const p = baueProduct(eingabe()) as any;
    expect(p.brand.name).toBe('Bosch');
    expect(p.model).toBe('GSR 18V-55');
    expect(p.mpn).toBe('06019H5200');
  });

  it('verschweigt Marke und Modell, wenn sie nirgends stehen duerfen', () => {
    const p = baueProduct(
      eingabe({
        generisch: true,
        name: 'Akkuschrauber 18 V',
        url: 'https://shop.example.de/akkuschrauber-18v',
        beschreibung: 'Gebrauchter Akkuschrauber, sofort ab Lager.',
      }),
    ) as any;
    expect(JSON.stringify(p)).not.toContain('Bosch');
    expect(JSON.stringify(p)).not.toContain('GSR 18V-55');
  });

  it('bricht ab, wenn die Marke ueber den Titel doch ins Markup kaeme', () => {
    // brand und mpn werden weggelassen — name kommt aber von aussen.
    expect(() => baueProduct(eingabe({ generisch: true }))).toThrow(/Bosch/);
  });

  it('bricht ab, wenn die Marke in der URL steckt', () => {
    expect(() =>
      baueProduct(eingabe({ generisch: true, name: 'Akkuschrauber', beschreibung: 'Gebraucht.' })),
    ).toThrow(/nirgends/);
  });

  it('bricht bei einer LAPP-Linie im Bildtext ab', () => {
    expect(() =>
      baueProduct(
        eingabe({
          generisch: true,
          erkennung: erkennung({ hersteller: null, modell: null }),
          name: 'Steuerleitung',
          url: 'https://shop.example.de/steuerleitung',
          beschreibung: 'Gebrauchte Steuerleitung.',
          bilder: [{ url: 'https://cdn.example.de/1.jpg', alt: 'OELFLEX Leitung, Vorderseite' }],
        }),
      ),
    ).toThrow(/OELFLEX/i);
  });

  it('erfindet keine GTIN aus der Hausnummern-EAN', () => {
    // Unsere internen EANs (Praefix 20) sind keine Hersteller-GTIN.
    const p = baueProduct(eingabe()) as any;
    expect(p.gtin13).toBeUndefined();
  });

  it('uebernimmt eine echte GTIN, wenn eine da ist', () => {
    const p = baueProduct(eingabe({ gtin: '4006381333931' })) as any;
    expect(p.gtin13).toBe('4006381333931');
  });

  it('uebertraegt die Merkmale als PropertyValue', () => {
    const p = baueProduct(eingabe()) as any;
    expect(p.additionalProperty).toEqual([{ '@type': 'PropertyValue', name: 'Spannung', value: '18 V' }]);
  });
});

describe('baueBreadcrumbList', () => {
  it('nummeriert die Positionen ab eins', () => {
    const b = baueBreadcrumbList([
      { name: 'Start', url: 'https://shop.example.de/' },
      { name: 'Werkzeug', url: 'https://shop.example.de/werkzeug' },
    ]) as any;
    expect(b.itemListElement[0].position).toBe(1);
    expect(b.itemListElement[1].position).toBe(2);
  });

  it('wirft relative Links raus', () => {
    const b = baueBreadcrumbList([
      { name: 'Start', url: '/' },
      { name: 'Werkzeug', url: 'https://shop.example.de/werkzeug' },
    ]) as any;
    expect(b.itemListElement).toHaveLength(1);
  });

  it('liefert nichts, wenn nichts Brauchbares uebrig bleibt', () => {
    expect(baueBreadcrumbList([{ name: 'Start', url: '/' }])).toBeNull();
    expect(baueBreadcrumbList([])).toBeNull();
  });
});

describe('baueFaqPage', () => {
  it('baut Frage und Antwort', () => {
    const f = baueFaqPage([{ frage: 'Ist ein Akku dabei?', antwort: 'Nein.' }]) as any;
    expect(f.mainEntity[0].name).toBe('Ist ein Akku dabei?');
    expect(f.mainEntity[0].acceptedAnswer.text).toBe('Nein.');
  });

  it('liefert kein leeres Geruest', () => {
    expect(baueFaqPage([])).toBeNull();
    expect(baueFaqPage([{ frage: 'A', antwort: '  ' }])).toBeNull();
  });
});

describe('baueImageObjects', () => {
  it('nimmt nur absolute Bildadressen', () => {
    const b = baueImageObjects([
      { url: 'https://cdn.example.de/1.jpg', alt: 'Vorderseite' },
      { url: '/lokal/2.jpg', alt: 'Rueckseite' },
    ]);
    expect(b).toHaveLength(1);
  });
});

describe('baueMarkup', () => {
  it('haelt die Reihenfolge Brotkrume, Produkt, Bilder, FAQ ein', () => {
    const teile = baueMarkup(
      eingabe({
        brotkrumen: [{ name: 'Start', url: 'https://shop.example.de/' }],
        bilder: [{ url: 'https://cdn.example.de/1.jpg', alt: 'Vorderseite' }],
        faq: [{ frage: 'A?', antwort: 'B.' }],
      }),
    ) as any[];
    expect(teile.map((t) => t['@type'])).toEqual(['BreadcrumbList', 'Product', 'ImageObject', 'FAQPage']);
  });

  it('bleibt ohne Beiwerk beim Produkt', () => {
    const teile = baueMarkup(eingabe()) as any[];
    expect(teile.map((t) => t['@type'])).toEqual(['Product']);
  });
});

describe('markupTag', () => {
  it('kann das Skript nicht vorzeitig beenden', () => {
    const tag = markupTag(eingabe({ name: 'Boesartig </script><img onerror=x>' }));
    expect(tag).not.toContain('</script><img');
    expect(tag).toContain('\\u003c/script');
  });
});
