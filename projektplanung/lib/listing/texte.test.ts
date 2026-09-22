import { describe, expect, it } from 'vitest';
import { MAX_TITEL_1, MAX_TITEL_2_3, pruefeListing, darfVeroeffentlichen } from './markenregeln';
import {
  ABSCHLUSSTEXT_FEST,
  abschlusstext,
  baueListing,
  baueProduktkarte,
  baueSortimentsverweis,
  baueTitel,
  begrenzeBullets,
  plural,
} from './texte';
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

describe('baueTitel', () => {
  it('kuerzt von hinten und laesst den Anfang stehen', () => {
    // Hersteller und Modell stehen vorn, weil danach gesucht wird.
    const titel = baueTitel(
      [{ text: 'Bosch', pflicht: true }, { text: 'GSR 18V-55' }, { text: 'Akkuschrauber' }, { text: 'mit Koffer' }],
      25,
    );
    expect(titel.startsWith('Bosch')).toBe(true);
    expect(titel.length).toBeLessThanOrEqual(25);
  });

  it('behaelt Pflichtbausteine', () => {
    const titel = baueTitel(
      [{ text: 'Sehr langer Herstellername GmbH' }, { text: 'Modell XL' }, { text: 'defekt', pflicht: true }],
      30,
    );
    expect(titel).toMatch(/defekt/);
  });

  it('schneidet zur Not an einer Wortgrenze', () => {
    const titel = baueTitel([{ text: 'Ein sehr langer Pflichttext ohne Ende', pflicht: true }], 20);
    expect(titel.length).toBeLessThanOrEqual(20);
    expect(titel.endsWith(' ')).toBe(false);
  });
});

describe('baueListing', () => {
  it('haelt die Titellaengen ein', () => {
    const l = baueListing({ erkennung: erkennung(), zustand: 'gebraucht' });
    expect(l.titel1.length).toBeLessThanOrEqual(MAX_TITEL_1);
    expect(l.titel2.length).toBeLessThanOrEqual(MAX_TITEL_2_3);
    expect(l.titel3.length).toBeLessThanOrEqual(MAX_TITEL_2_3);
  });

  it('schreibt "defekt" in den Titel', () => {
    const l = baueListing({ erkennung: erkennung(), zustand: 'defekt' });
    expect(l.titel1).toMatch(/defekt/);
    expect(l.beschreibung).toMatch(/[Dd]efekt/);
  });

  it('textet LAPP-Ware generisch', () => {
    // Weder Hersteller noch Produktlinie duerfen irgendwo auftauchen.
    const l = baueListing({
      erkennung: erkennung({ hersteller: 'LAPP', titel: 'LAPP ÖLFLEX CLASSIC 110', artikelTyp: 'Steuerleitung' }),
      zustand: 'gebraucht',
    });
    expect(l.generisch).toBe(true);
    const alles = `${l.titel1} ${l.titel2} ${l.titel3} ${l.beschreibung}`;
    expect(alles).not.toMatch(/LAPP/i);
    expect(alles).not.toMatch(/ÖLFLEX/i);
  });

  it('setzt bei SKF den Pflichtsatz in die Beschreibung', () => {
    const l = baueListing({ erkennung: erkennung({ hersteller: 'SKF' }), zustand: 'neu' });
    expect(l.beschreibung).toMatch(/dürfen wir nicht NEU schreiben/);
  });

  it('kommt durch die eigene Markenpruefung', () => {
    // Was der Textbau erzeugt, muss die Sperre bestehen — sonst baut die eine
    // Haelfte, was die andere verbietet.
    for (const fall of [
      { erk: erkennung(), zustand: 'gebraucht' as const },
      { erk: erkennung(), zustand: 'defekt' as const },
      { erk: erkennung({ hersteller: 'SKF' }), zustand: 'neu' as const },
      { erk: erkennung({ hersteller: 'LAPP', titel: 'LAPP ÖLFLEX', artikelTyp: 'Steuerleitung' }), zustand: 'gebraucht' as const },
    ]) {
      const l = baueListing({ erkennung: fall.erk, zustand: fall.zustand });
      const befunde = pruefeListing({
        hersteller: l.generisch ? null : fall.erk.hersteller,
        titel1: l.titel1,
        titel2: l.titel2,
        titel3: l.titel3,
        beschreibung: l.beschreibung,
        zustand: fall.zustand,
      });
      expect(darfVeroeffentlichen(befunde), `${fall.erk.hersteller} / ${fall.zustand}: ${JSON.stringify(befunde)}`).toBe(true);
    }
  });

  it('nimmt die Notiz des Menschen in den Zustandsteil auf', () => {
    const l = baueListing({ erkennung: erkennung(), zustand: 'gebraucht', notiz: 'Fernbedienung fehlt' });
    expect(l.beschreibung).toMatch(/Fernbedienung fehlt/);
  });

  it('setzt den Abschlusstext unter die Beschreibung', () => {
    const b = baueListing({ erkennung: erkennung(), zustand: 'gebraucht' }).beschreibung;
    expect(b).toContain(ABSCHLUSSTEXT_FEST);
  });

  it('passt den Abschlusstext an den Artikel an', () => {
    const b = baueListing({
      erkennung: erkennung({ artikelTyp: 'Schneidemaschine' }),
      zustand: 'gebraucht',
    }).beschreibung;
    expect(b).toContain(
      'Weitere Schneidemaschinen in anderen Gr\u00f6\u00dfen \u2013 neu und gebraucht \u2013 finden Sie in unserem Shop! ' +
        'Internationale Versandkosten auf Anfrage!',
    );
  });

  it('uebernimmt einen vorgegebenen Sortimentsverweis', () => {
    const b = baueListing({
      erkennung: erkennung(),
      zustand: 'gebraucht',
      sortimentsverweis: 'Weitere Akkuschrauber in anderen Spannungen',
    }).beschreibung;
    expect(b).toContain(
      'Weitere Akkuschrauber in anderen Spannungen \u2013 neu und gebraucht \u2013 finden Sie in unserem Shop!',
    );
  });

  it('setzt keine Anfuehrungszeichen um den Verweis', () => {
    // Die Anfuehrungszeichen der Vorlage markieren den variablen Teil,
    // sie gehoeren nicht in den Text.
    const b = baueListing({
      erkennung: erkennung({ artikelTyp: 'Schneidemaschine' }),
      zustand: 'gebraucht',
    }).beschreibung;
    expect(b).not.toMatch(/["\u201e\u201c]Weitere/);
  });
});

describe('begrenzeBullets', () => {
  it('nimmt hoechstens fuenf', () => {
    expect(begrenzeBullets(['a', 'b', 'c', 'd', 'e', 'f'])).toHaveLength(5);
  });

  it('kuerzt einen zu langen Punkt auf 200 Zeichen', () => {
    expect(begrenzeBullets(['x'.repeat(300)])[0]).toHaveLength(200);
  });

  it('haelt die Gesamtlaenge unter 1000 Zeichen', () => {
    const bullets = begrenzeBullets(Array(5).fill('y'.repeat(200)));
    expect(bullets.join('').length).toBeLessThanOrEqual(1000);
  });

  it('wirft leere Punkte weg', () => {
    expect(begrenzeBullets(['', '   ', 'echt'])).toEqual(['echt']);
  });
});

describe('baueProduktkarte', () => {
  it('folgt der vorgegebenen Gliederung', () => {
    const html = baueProduktkarte({
      erkennung: erkennung(),
      zustand: 'gebraucht',
      generisch: false,
      fliesstext: {
        teaser: 'Ein Teaser.',
        bullets: ['Punkt eins', 'Punkt zwei'],
        anwendung: 'Für Montagearbeiten.',
        vorteile: 'Robust und sofort einsatzbereit.',
        faq: [{ frage: 'Ist Versand inklusive?', antwort: 'Nein, Versand wird gesondert berechnet.' }],
      },
    });
    expect(html).toMatch(/<h1>/);
    expect(html).toMatch(/<h2>Merkmale<\/h2>/);
    expect(html).toMatch(/<h3>Anwendung<\/h3>/);
    expect(html).toMatch(/<h2>FAQ: Fragen und Antworten<\/h2>/);
    expect(html).toMatch(/<h2>Warum Sie bei uns kaufen sollten<\/h2>/);
  });

  it('laesst leere Abschnitte ganz weg', () => {
    // Eine Ueberschrift ohne Inhalt sieht fuer Google nach unfertiger Seite aus.
    const html = baueProduktkarte({ erkennung: erkennung(), zustand: 'gebraucht', generisch: false });
    expect(html).not.toMatch(/<h3>Anwendung<\/h3>/);
    expect(html).not.toMatch(/FAQ/);
  });

  it('hat genau ein H1', () => {
    const html = baueProduktkarte({ erkennung: erkennung(), zustand: 'gebraucht', generisch: false });
    expect(html.match(/<h1>/g)).toHaveLength(1);
  });

  it('entkommt spitze Klammern aus den Daten', () => {
    const html = baueProduktkarte({
      erkennung: erkennung({ titel: 'Teil <script>alert(1)</script>' }),
      zustand: 'gebraucht',
      generisch: false,
    });
    expect(html).not.toMatch(/<script>/);
  });
});

describe('plural', () => {
  it('bildet sichere Plurale', () => {
    expect(plural('Schneidemaschine')).toBe('Schneidemaschinen');
    expect(plural('Schraube')).toBe('Schrauben');
    expect(plural('Motor')).toBe('Motoren');
    expect(plural('Dichtung')).toBe('Dichtungen');
  });

  it('laesst gleichlautende Plurale stehen', () => {
    expect(plural('Akkuschrauber')).toBe('Akkuschrauber');
    expect(plural('Hebel')).toBe('Hebel');
  });

  it('raet nicht, wenn die Endung nicht eindeutig ist', () => {
    // Lieber ein blasserer Satz als „Weitere Schranks".
    expect(plural('Schrank')).toBeNull();
    expect(plural('Ventil')).toBeNull();
    expect(plural('')).toBeNull();
    expect(plural(null)).toBeNull();
  });

  it('raet bei mehrteiligen Bezeichnungen gar nicht', () => {
    expect(plural('hydraulische Presse')).toBeNull();
  });
});

describe('baueSortimentsverweis', () => {
  it('nennt die Warengruppe im Plural', () => {
    expect(baueSortimentsverweis('Schneidemaschine')).toBe('Weitere Schneidemaschinen in anderen Gr\u00f6\u00dfen');
  });

  it('nimmt die uebergebene Dimension', () => {
    expect(baueSortimentsverweis('Schraube', 'L\u00e4ngen')).toBe('Weitere Schrauben in anderen L\u00e4ngen');
  });

  it('weicht aus, wenn der Plural unsicher ist', () => {
    expect(baueSortimentsverweis('Schrank')).toBe('Weitere Artikel dieser Art in anderen Gr\u00f6\u00dfen');
  });
});

describe('abschlusstext', () => {
  it('haengt den festen Teil an den Verweis', () => {
    expect(abschlusstext('Weitere Pumpen in anderen Gr\u00f6\u00dfen')).toBe(
      'Weitere Pumpen in anderen Gr\u00f6\u00dfen \u2013 ' + ABSCHLUSSTEXT_FEST,
    );
  });

  it('bleibt ohne Verweis ein ganzer Satz', () => {
    expect(abschlusstext(null)).toBe('Weitere Artikel \u2013 ' + ABSCHLUSSTEXT_FEST);
    expect(abschlusstext('   ')).toBe('Weitere Artikel \u2013 ' + ABSCHLUSSTEXT_FEST);
  });

  it('haengt keinen zweiten Gedankenstrich an', () => {
    expect(abschlusstext('Weitere Pumpen \u2013')).toBe('Weitere Pumpen \u2013 ' + ABSCHLUSSTEXT_FEST);
  });
});
