import { describe, expect, it } from 'vitest';
import { baueListingpaket, type ZusammenbauEingabe } from './zusammenbau';
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

function eingabe(teil: Partial<ZusammenbauEingabe> = {}): ZusammenbauEingabe {
  return {
    erkennung: erkennung(),
    zustand: 'gebraucht',
    ean: '2000000000015',
    bestand: 1,
    preis: 46,
    shopBasis: 'https://shop.example.de',
    bildUrls: ['https://cdn.example.de/1.jpg', 'https://cdn.example.de/2.jpg'],
    bildRollen: ['uebersicht', 'typenschild'],
    ...teil,
  };
}

describe('baueListingpaket', () => {
  it('liefert Titel, Produktkarte und SEO-Felder', () => {
    const p = baueListingpaket(eingabe());
    expect(p.listing.titel1.length).toBeGreaterThan(0);
    expect(p.produktkarte).toContain('<h1>');
    expect(p.seoTitle).toContain('Komplett Konzept');
    expect(p.metaDescription.length).toBeGreaterThanOrEqual(135);
    expect(p.metaDescription.length).toBeLessThanOrEqual(160);
  });

  it('setzt den Abschlusstext in die Produktkarte', () => {
    const p = baueListingpaket(eingabe());
    expect(p.produktkarte).toContain('Internationale Versandkosten auf Anfrage!');
  });

  it('baut Alt-Texte und Dateinamen zu den Bildern', () => {
    const p = baueListingpaket(eingabe());
    expect(p.bilder).toHaveLength(2);
    expect(p.bilder[0].alt.length).toBeGreaterThan(0);
    expect(p.bilder[0].dateiname).toContain('bosch');
  });

  it('baut das Markup mit Produkt und Bildern', () => {
    const p = baueListingpaket(eingabe());
    const typen = (p.markup as any[]).map((m) => m['@type']);
    expect(typen).toContain('Product');
    expect(typen).toContain('ImageObject');
  });

  it('nimmt die FAQ aus dem Fliesstext ins Markup', () => {
    const p = baueListingpaket(
      eingabe({ fliesstext: { faq: [{ frage: 'Ist ein Akku dabei?', antwort: 'Nein.' }] } }),
    );
    expect((p.markup as any[]).map((m) => m['@type'])).toContain('FAQPage');
    expect(p.produktkarte).toContain('Ist ein Akku dabei?');
  });

  it('baut ohne Shop-Adresse kein Markup', () => {
    // Relative Adressen im JSON-LD meldet Google als Fehler.
    expect(baueListingpaket(eingabe({ shopBasis: null })).markup).toHaveLength(0);
  });

  it('laesst ein freigegebenes Listing durch', () => {
    expect(baueListingpaket(eingabe()).darfVeroeffentlichtWerden).toBe(true);
  });

  it('textet LAPP generisch — Marke und Linie stehen nirgends', () => {
    // Nicht gesperrt, sondern umgeschrieben: Generisch getextet darf der
    // Artikel online, nur eben ohne Herstellernamen und ohne Produktlinie.
    const p = baueListingpaket(
      eingabe({ erkennung: erkennung({ hersteller: 'LAPP', modell: 'ÖLFLEX CLASSIC 110' }) }),
    );
    expect(p.listing.generisch).toBe(true);
    expect(p.darfVeroeffentlichtWerden).toBe(true);

    // „darf nirgendswo stehen" — also in keinem einzigen Feld des Pakets.
    const alles = JSON.stringify(p);
    expect(alles).not.toMatch(/LAPP/i);
    expect(alles).not.toMatch(/ÖLFLEX/i);
    expect(alles).not.toMatch(/OELFLEX/i);
  });

  it('nennt defekt im Titel und in der Beschreibung', () => {
    const p = baueListingpaket(eingabe({ zustand: 'defekt' }));
    expect(p.listing.titel1.toLowerCase()).toContain('defekt');
    expect(p.produktkarte.toLowerCase()).toContain('defekt');
    expect(p.darfVeroeffentlichtWerden).toBe(true);
  });

  it('uebernimmt einen vorgegebenen Sortimentsverweis', () => {
    const p = baueListingpaket(eingabe({ sortimentsverweis: 'Weitere Akkuschrauber in anderen Spannungen' }));
    expect(p.produktkarte).toContain('Weitere Akkuschrauber in anderen Spannungen');
  });

  it('baut einen URL-Pfad ohne Sonderzeichen', () => {
    const p = baueListingpaket(eingabe());
    expect(p.urlPfad).toMatch(/^[a-z0-9-]+$/);
  });

  it('setzt ohne Preis kein Angebot ins Markup', () => {
    const p = baueListingpaket(eingabe({ preis: null }));
    const produkt = (p.markup as any[]).find((m) => m['@type'] === 'Product');
    expect(produkt.offers).toBeUndefined();
  });
});
