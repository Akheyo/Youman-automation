import { describe, expect, it } from 'vitest';
import {
  MAX_META_DESCRIPTION,
  MAX_TITLE_VOR_TRENNER,
  SHOPNAME,
  baueMetaDescription,
  baueMetaKeywords,
  baueSeoTitle,
  baueUrlPfad,
  bildAltText,
  bildDateiname,
  metaDescriptionInOrdnung,
  nummernVarianten,
  suchbegriffeZeile,
  type SeoEingabe,
} from './seo';

function e(teil: Partial<SeoEingabe> = {}): SeoEingabe {
  return {
    artikelTyp: 'Akkuschrauber',
    hersteller: 'Bosch',
    modell: 'GSR 18V-55',
    modellnummer: '06019H5200',
    kennwerte: ['18 V'],
    zustandsText: 'gebraucht',
    verwendung: 'Für Montage und Werkstatt',
    generisch: false,
    ...teil,
  };
}

describe('nummernVarianten', () => {
  it('liefert die Schreibweisen, nach denen wirklich gesucht wird', () => {
    const v = nummernVarianten('0601 9H5-200');
    expect(v).toContain('0601 9H5-200');
    expect(v).toContain('06019H5200');
    expect(v).toContain('0601-9H5-200');
  });

  it('erfindet nichts', () => {
    // Eine ausgedachte Variante traefe nichts und stuende nur im Weg.
    expect(nummernVarianten('ABC123')).toEqual(['ABC123']);
  });

  it('ignoriert zu kurze Angaben', () => {
    expect(nummernVarianten('A1')).toEqual([]);
    expect(nummernVarianten(null)).toEqual([]);
  });
});

describe('suchbegriffeZeile', () => {
  it('nennt die Varianten, wenn es echte gibt', () => {
    expect(suchbegriffeZeile('0601 9H5 200')).toMatch(/Auch gesucht als:/);
  });

  it('schweigt, wenn es nichts zu ergaenzen gibt', () => {
    expect(suchbegriffeZeile('ABC123')).toBe('');
    expect(suchbegriffeZeile(null)).toBe('');
  });
});

describe('baueSeoTitle', () => {
  it('folgt der Formel: Produkt + kaufen | Shop', () => {
    const titel = baueSeoTitle(e());
    expect(titel).toMatch(/^Bosch GSR 18V-55 Akkuschrauber kaufen/);
    expect(titel.endsWith(`| ${SHOPNAME}`)).toBe(true);
  });

  it('haelt den Teil vor dem Trennzeichen unter 58 Zeichen', () => {
    const titel = baueSeoTitle(
      e({ hersteller: 'Sehr Langer Herstellername GmbH', modell: 'Modellbezeichnung XL 9000 Ultra' }),
    );
    const vorn = titel.split('|')[0].trim();
    expect(vorn.length).toBeLessThanOrEqual(MAX_TITLE_VOR_TRENNER);
  });

  it('laesst Hersteller und Modell bei LAPP weg', () => {
    const titel = baueSeoTitle(e({ generisch: true, hersteller: 'LAPP', modell: 'ÖLFLEX' }));
    expect(titel).not.toMatch(/LAPP/i);
    expect(titel).not.toMatch(/ÖLFLEX/i);
    expect(titel).toMatch(/^Akkuschrauber kaufen/);
  });

  it('nimmt Kennwerte nur mit, solange Platz ist', () => {
    const titel = baueSeoTitle(e({ kennwerte: ['18 V', '5 Ah', 'mit Koffer', 'Made in Germany'] }));
    expect(titel.split('|')[0].trim().length).toBeLessThanOrEqual(MAX_TITLE_VOR_TRENNER);
  });
});

describe('baueMetaDescription', () => {
  it('bleibt im vorgegebenen Fenster', () => {
    const text = baueMetaDescription(e());
    expect(text.length).toBeLessThanOrEqual(MAX_META_DESCRIPTION);
    expect(metaDescriptionInOrdnung(text)).toBe(true);
  });

  it('enthaelt die vorgeschriebenen Bausteine', () => {
    const text = baueMetaDescription(e());
    expect(text).toMatch(/★/);
    expect(text).toMatch(/✓/);
    expect(text).toMatch(new RegExp(SHOPNAME));
  });

  it('behaelt den Handlungsaufruf auch bei sehr langem Kopf', () => {
    // Gekuerzt wird von hinten nach Wichtigkeit — der Aufruf bleibt stehen.
    const text = baueMetaDescription(
      e({
        hersteller: 'Ein ziemlich langer Herstellername',
        modell: 'Mit einer langen Modellbezeichnung XL',
        artikelTyp: 'Industriestaubsauger mit Zubehoerpaket',
      }),
    );
    expect(text.length).toBeLessThanOrEqual(MAX_META_DESCRIPTION);
    expect(text).toMatch(/bestellen!/);
  });

  it('nennt bei LAPP weder Hersteller noch Linie', () => {
    const text = baueMetaDescription(e({ generisch: true, hersteller: 'LAPP', modell: 'ÖLFLEX' }));
    expect(text).not.toMatch(/LAPP/i);
    expect(text).not.toMatch(/ÖLFLEX/i);
  });
});

describe('baueMetaKeywords', () => {
  it('nimmt Hersteller, Modell und die Nummernvarianten auf', () => {
    const k = baueMetaKeywords(e());
    expect(k).toContain('Bosch');
    expect(k).toContain('06019H5200');
  });

  it('nennt nichts zweimal', () => {
    const k = baueMetaKeywords(e());
    expect(new Set(k.map((x) => x.toLowerCase())).size).toBe(k.length);
  });

  it('bleibt kurz — eine lange Liste macht die Shopsuche ungenauer', () => {
    expect(baueMetaKeywords(e()).length).toBeLessThanOrEqual(20);
  });

  it('haelt bei LAPP den Hersteller heraus', () => {
    const k = baueMetaKeywords(e({ generisch: true, hersteller: 'LAPP', modell: 'ÖLFLEX' }));
    expect(k.join(' ')).not.toMatch(/LAPP|ÖLFLEX/i);
  });
});

describe('baueUrlPfad', () => {
  it('schreibt Umlaute aus', () => {
    expect(baueUrlPfad('Bügelmessschraube für Öl & Süßwasser')).toBe('buegelmessschraube-fuer-oel-suesswasser');
  });

  it('endet nie auf einem Bindestrich', () => {
    expect(baueUrlPfad('Test — ')).toBe('test');
    expect(baueUrlPfad('A'.repeat(200)).endsWith('-')).toBe(false);
  });
});

describe('Bilder', () => {
  it('baut Dateinamen ohne Umlaute und Leerzeichen', () => {
    const name = bildDateiname('Bosch GSR 18V-55 Akkuschrauber', 1);
    expect(name).toMatch(/^[a-z0-9-]+-foto1\.jpg$/);
  });

  it('beschreibt im Alt-Text, was zu sehen ist', () => {
    expect(bildAltText('Bosch GSR 18V-55', 'typenschild', 2)).toMatch(/Typenschild/);
    expect(bildAltText('Bosch GSR 18V-55', null, 3)).toMatch(/Ansicht 3/);
  });
});
