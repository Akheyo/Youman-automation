import { describe, expect, it } from 'vitest';
import {
  baueAnzeige,
  fingerabdruck,
  inCent,
  kuerzeMpn,
  kuerzeTitel,
  normalisierePlz,
  TITEL_VORGABE,
} from './anzeige';

const gut = {
  titel: 'Bosch GBH 2-26 boorhamer',
  beschreibung: 'Gebruikte boorhamer, technisch in orde. Zie fotos.',
  kategorieId: 1234,
  preisEuro: 89.9,
  postleitzahl: '1097DN',
};

describe('inCent', () => {
  it('rechnet Euro in ganzzahlige Cent', () => {
    expect(inCent(19.99)).toBe(1999);
    expect(inCent(89.9)).toBe(8990);
    expect(inCent(1)).toBe(100);
  });

  it('rundet Gleitkomma-Reste weg statt abzuschneiden', () => {
    // 12.1 * 100 ist in Gleitkomma 1209.9999999999998 — abschneiden ergaebe 1209.
    expect(inCent(12.1)).toBe(1210);
    expect(inCent(0.29)).toBe(29);
  });

  it('macht aus fehlenden, negativen und Null-Preisen null', () => {
    expect(inCent(null)).toBeNull();
    expect(inCent(undefined)).toBeNull();
    expect(inCent(0)).toBeNull();
    expect(inCent(-5)).toBeNull();
    expect(inCent(Number.NaN)).toBeNull();
  });
});

describe('kuerzeTitel', () => {
  it('laesst kurze Titel unberuehrt', () => {
    expect(kuerzeTitel('Kurzer Titel', 60)).toBe('Kurzer Titel');
  });

  it('schneidet an der Wortgrenze', () => {
    const lang = 'Hydraulikpumpe Bosch Rexroth A10VSO Baugroesse 45 gebraucht geprueft';
    const kurz = kuerzeTitel(lang, 40);
    expect(kurz.length).toBeLessThanOrEqual(40);
    expect(lang.startsWith(kurz)).toBe(true);
    expect(kurz.endsWith(' ')).toBe(false);
    // Kein angebrochenes Wort am Ende.
    expect(lang[kurz.length] === ' ' || kurz.length === lang.length).toBe(true);
  });

  it('schneidet hart, wenn das erste Wort schon zu lang ist', () => {
    const kurz = kuerzeTitel('Rundschleifmaschinensteuerungseinheit X', 20);
    expect(kurz).toHaveLength(20);
  });

  it('macht mehrfache Leerzeichen zu einem', () => {
    expect(kuerzeTitel('  Bosch   GBH  ', 60)).toBe('Bosch GBH');
  });
});

describe('normalisierePlz', () => {
  it('entfernt das Leerzeichen und macht Grossbuchstaben', () => {
    expect(normalisierePlz('1097 dn')).toBe('1097DN');
  });

  it('weist alles zurueck, was keine niederlaendische PLZ ist', () => {
    expect(normalisierePlz('46325')).toBeNull(); // deutsche PLZ
    expect(normalisierePlz('')).toBeNull();
    expect(normalisierePlz(null)).toBeNull();
    expect(normalisierePlz('10970DN')).toBeNull();
  });
});

describe('kuerzeMpn', () => {
  it('kuerzt auf 25 Zeichen', () => {
    expect(kuerzeMpn('A'.repeat(40))).toHaveLength(25);
  });
  it('macht aus leer null', () => {
    expect(kuerzeMpn('   ')).toBeNull();
  });
});

describe('baueAnzeige', () => {
  it('baut den Koerper so, wie die API ihn erwartet', () => {
    const { anzeige, bereit } = baueAnzeige(gut);
    expect(bereit).toBe(true);
    expect(anzeige).toEqual({
      translations: [{ locale: 'nl-NL', title: gut.titel, description: gut.beschreibung }],
      categoryId: 1234,
      location: { postcode: '1097DN' },
      priceModel: { modelType: 'fixed', askingPrice: 8990 },
      reserved: false,
    });
  });

  it('haengt Versandkosten in Cent an, wenn es welche gibt', () => {
    const { anzeige } = baueAnzeige({ ...gut, versandEuro: 6.95 });
    expect(anzeige?.priceModel.shippingCosts).toBe(695);
  });

  it('laesst die Versandkosten weg, wenn keine hinterlegt sind', () => {
    const { anzeige } = baueAnzeige({ ...gut, versandEuro: null });
    expect(anzeige?.priceModel.shippingCosts).toBeUndefined();
  });

  it('haelt eine Anzeige ohne Kategorie zurueck und sagt warum', () => {
    const { anzeige, bereit, befunde } = baueAnzeige({ ...gut, kategorieId: null });
    expect(bereit).toBe(false);
    expect(anzeige).toBeNull();
    expect(befunde.some((b) => b.feld === 'kategorieId' && b.art === 'fehlt')).toBe(true);
  });

  it('haelt eine Anzeige ohne Preis zurueck', () => {
    const { bereit, befunde } = baueAnzeige({ ...gut, preisEuro: null });
    expect(bereit).toBe(false);
    expect(befunde.some((b) => b.feld === 'preis')).toBe(true);
  });

  it('haelt eine Anzeige mit deutscher Postleitzahl zurueck', () => {
    const { bereit, befunde } = baueAnzeige({ ...gut, postleitzahl: '46325' });
    expect(bereit).toBe(false);
    expect(befunde.some((b) => b.feld === 'postleitzahl')).toBe(true);
  });

  it('kuerzt den Titel und vermerkt es', () => {
    const lang = 'A'.repeat(20) + ' ' + 'B'.repeat(80);
    const { anzeige, befunde, bereit } = baueAnzeige({ ...gut, titel: lang });
    expect(bereit).toBe(true);
    expect(anzeige!.translations[0].title.length).toBeLessThanOrEqual(TITEL_VORGABE);
    expect(befunde.some((b) => b.art === 'gekuerzt' && b.feld === 'titel')).toBe(true);
  });

  it('nimmt die Titelgrenze an, die die API gemeldet hat', () => {
    const { anzeige } = baueAnzeige({ ...gut, titel: 'A'.repeat(50), maxTitel: 30 });
    expect(anzeige!.translations[0].title).toHaveLength(30);
  });

  it('laesst einen Shop-Link ohne Protokoll weg, statt die Anzeige zu verlieren', () => {
    const { anzeige, befunde, bereit } = baueAnzeige({ ...gut, shopUrl: 'shop.example.de/artikel/1' });
    expect(bereit).toBe(true);
    expect(anzeige!.url).toBeUndefined();
    expect(befunde.some((b) => b.feld === 'url')).toBe(true);
  });

  it('uebernimmt einen gueltigen Shop-Link', () => {
    const { anzeige } = baueAnzeige({ ...gut, shopUrl: 'https://shop.example.de/a/1' });
    expect(anzeige!.url).toBe('https://shop.example.de/a/1');
  });
});

describe('fingerabdruck', () => {
  it('ist gleich, solange sich nichts aendert', () => {
    const a = baueAnzeige(gut).anzeige!;
    const b = baueAnzeige({ ...gut }).anzeige!;
    expect(fingerabdruck(a)).toBe(fingerabdruck(b));
  });

  it('aendert sich mit dem Preis', () => {
    const a = baueAnzeige(gut).anzeige!;
    const b = baueAnzeige({ ...gut, preisEuro: 79.9 }).anzeige!;
    expect(fingerabdruck(a)).not.toBe(fingerabdruck(b));
  });

  it('aendert sich, wenn nur mitten im Text etwas anders ist', () => {
    const a = baueAnzeige(gut).anzeige!;
    const lang = 'x'.repeat(100);
    const b = baueAnzeige({ ...gut, beschreibung: `${lang}A${lang}` }).anzeige!;
    const c = baueAnzeige({ ...gut, beschreibung: `${lang}B${lang}` }).anzeige!;
    expect(fingerabdruck(a)).not.toBe(fingerabdruck(b));
    // Gleiche Laenge, gleicher Anfang, gleiches Ende — hier ist der
    // Fingerabdruck absichtlich blind. Das ist die bewusste Grenze.
    expect(fingerabdruck(b)).toBe(fingerabdruck(c));
  });
});
