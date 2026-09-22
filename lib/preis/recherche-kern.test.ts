import { describe, expect, it } from 'vitest';
import { baueSuchauftraege, herleitungText, kuerzungsleiter, segmente } from './recherche-kern';
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

describe('segmente', () => {
  it('trennt an Trennzeichen und am Wechsel Buchstabe/Ziffer', () => {
    expect(segmente('1LA7130-4AA10')).toEqual(['1', 'LA', '7130', '4', 'AA', '10']);
  });

  it('kommt mit einer reinen Ziffernnummer zurecht', () => {
    expect(segmente('281007507')).toEqual(['281007507']);
  });

  it('liefert fuer nichts nichts', () => {
    expect(segmente('')).toEqual([]);
  });
});

describe('kuerzungsleiter', () => {
  it('beginnt mit der vollstaendigen Nummer', () => {
    expect(kuerzungsleiter('1LA7130-4AA10')[0]).toBe('1LA7130-4AA10');
  });

  it('kuerzt an den Fugen, nicht zeichenweise', () => {
    const leiter = kuerzungsleiter('1LA7130-4AA10');
    // Nach der vollstaendigen Nummer faellt das letzte Segment weg.
    expect(leiter).toContain('1LA71304AA');
    expect(leiter).toContain('1LA7130');
    expect(leiter).not.toContain('1LA7130-4AA1');
  });

  it('kuerzt eine reine Ziffernnummer ziffernweise', () => {
    const leiter = kuerzungsleiter('281007507');
    expect(leiter[0]).toBe('281007507');
    expect(leiter).toContain('28100750');
    expect(leiter).toContain('281');
  });

  it('hoert auf, bevor die Nummer beliebig wird', () => {
    for (const sprosse of kuerzungsleiter('281007507')) {
      expect(sprosse.replace(/[^A-Za-z0-9]/g, '').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('liefert ohne Nummer nichts', () => {
    expect(kuerzungsleiter(null)).toEqual([]);
    expect(kuerzungsleiter('  ')).toEqual([]);
  });

  it('wiederholt keine Sprosse', () => {
    const leiter = kuerzungsleiter('AB-12-34');
    expect(new Set(leiter).size).toBe(leiter.length);
  });
});

describe('baueSuchauftraege', () => {
  it('sucht zuerst nach dem exakten Produkt', () => {
    const a = baueSuchauftraege(erkennung());
    expect(a[0].absicht).toBe('exakt');
    expect(a[0].begriff).toBe('Bosch 06019H5200');
  });

  it('geht von scharf nach unscharf', () => {
    const a = baueSuchauftraege(erkennung());
    const rang = { exakt: 0, baureihe: 1, gattung: 2, technisch: 3 };
    const folge = a.map((x) => rang[x.absicht]);
    expect(folge).toEqual([...folge].sort((x, y) => x - y));
  });

  it('endet bei der Warengattung', () => {
    const a = baueSuchauftraege(erkennung());
    expect(a[a.length - 1].absicht).toBe('technisch');
  });

  it('nimmt ohne Typenschild die technischen Daten', () => {
    const a = baueSuchauftraege(
      erkennung({
        hersteller: null,
        modell: null,
        modellnummer: null,
        typenschildGefunden: false,
        artikelTyp: 'Schaltschrank',
        merkmale: [],
        masseCm: { laenge: 60, breite: 40, hoehe: 20 },
      }),
    );
    expect(a.some((x) => x.begriff.includes('60 x 40 x 20'))).toBe(true);
  });

  it('laesst bei generischer Textung den Hersteller weg', () => {
    // Ein Preis, den wir nur ueber den verbotenen Markennamen finden,
    // verleitet zu einem Listing, das wir nicht veroeffentlichen duerfen.
    const a = baueSuchauftraege(erkennung(), { generisch: true });
    expect(a.every((x) => !x.begriff.includes('Bosch'))).toBe(true);
    expect(a.every((x) => !x.begriff.includes('GSR'))).toBe(true);
  });

  it('sucht nicht zweimal dasselbe', () => {
    const a = baueSuchauftraege(erkennung({ modell: '06019H5200' }));
    const begriffe = a.map((x) => x.begriff.toLowerCase());
    expect(new Set(begriffe).size).toBe(begriffe.length);
  });

  it('markiert die Guete absteigend', () => {
    const a = baueSuchauftraege(erkennung());
    expect(a[0].guete).toBe('hoch');
    expect(a[a.length - 1].guete).toBe('niedrig');
  });
});

describe('herleitungText', () => {
  it('haelt jeden Versuch fest', () => {
    const t = herleitungText({
      versuche: [
        { begriff: 'Bosch 06019H5200', treffer: 0, erklaerung: 'Exaktes Produkt: Bosch 06019H5200.' },
        { begriff: 'Bosch 06019H52', treffer: 3, erklaerung: 'Typennummer gekuerzt.' },
      ],
      quelle: 'eBay.de, deutsche Angebote',
      guete: 'hoch',
      zeilen: ['Referenz 44 EUR inkl. Versand.'],
    });
    expect(t).toContain('kein Treffer');
    expect(t).toContain('3 Angebot(e)');
    expect(t).toContain('eBay.de');
    expect(t).toContain('Referenz 44 EUR');
  });
});
