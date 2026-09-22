import { describe, expect, it } from 'vitest';
import {
  bereinigeFliesstext,
  datengrundlage,
  entferneErfundeneSaetze,
  fliesstextAlsText,
  gedeckteAngaben,
  pruefeFliesstext,
  type FliesstextEingabe,
} from './fliesstext';
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

function eingabe(teil: Partial<FliesstextEingabe> = {}): FliesstextEingabe {
  return { erkennung: erkennung(), zustand: 'gebraucht', generisch: false, ...teil };
}

describe('datengrundlage', () => {
  it('nennt die Merkmale', () => {
    expect(datengrundlage(eingabe())).toContain('Spannung: 18 V');
  });

  it('macht fehlende Angaben ausdruecklich', () => {
    const t = datengrundlage(eingabe());
    expect(t).toContain('Lieferumfang: nicht dokumentiert');
    expect(t).toContain('Festgestellte Maengel: keine sichtbaren'.replace('Maengel', 'Mängel'));
  });

  it('verschweigt bei generisch den Hersteller', () => {
    const t = datengrundlage(eingabe({ generisch: true }));
    expect(t).not.toContain('Bosch');
    expect(t).not.toContain('GSR 18V-55');
  });

  it('nimmt die Notiz des Menschen mit', () => {
    expect(datengrundlage(eingabe({ notiz: 'Akku fehlt' }))).toContain('Akku fehlt');
  });
});

describe('gedeckteAngaben', () => {
  it('erkennt Angaben aus den Merkmalen', () => {
    expect(gedeckteAngaben(eingabe()).has('18v')).toBe(true);
  });

  it('gleicht Schreibweisen an', () => {
    const e = eingabe({ erkennung: erkennung({ merkmale: [{ name: 'Querschnitt', wert: '1,5 mm²' }] }) });
    const g = gedeckteAngaben(e);
    expect(g.has('1.5mm²')).toBe(true);
  });
});

describe('pruefeFliesstext', () => {
  it('faengt eine erfundene Leistungsangabe', () => {
    const b = pruefeFliesstext('Das Geraet leistet 750 W und wiegt 2,3 kg.', eingabe());
    expect(b.erfundeneAngaben).toContain('750 W');
    expect(b.erfundeneAngaben).toContain('2,3 kg');
  });

  it('laesst gedeckte Angaben stehen', () => {
    const b = pruefeFliesstext('Der Akkuschrauber arbeitet mit 18 V.', eingabe());
    expect(b.erfundeneAngaben).toHaveLength(0);
  });

  it('akzeptiert eine andere Schreibweise derselben Angabe', () => {
    const b = pruefeFliesstext('Betriebsspannung 18V.', eingabe());
    expect(b.erfundeneAngaben).toHaveLength(0);
  });

  it('stoert sich nicht an Zahlen ohne Einheit', () => {
    const b = pruefeFliesstext('Im Karton liegen 100 Stueck.', eingabe());
    expect(b.erfundeneAngaben).toHaveLength(0);
  });

  it('meldet den Herstellernamen, wenn generisch getextet werden muss', () => {
    const b = pruefeFliesstext('Diese Leitung von Bosch ist robust.', eingabe({ generisch: true }));
    expect(b.markeVerraten).toContain('Bosch');
  });

  it('meldet die Marke nicht, wenn sie genannt werden darf', () => {
    const b = pruefeFliesstext('Diese Maschine von Bosch ist robust.', eingabe());
    expect(b.markeVerraten).toHaveLength(0);
  });
});

describe('entferneErfundeneSaetze', () => {
  it('wirft den ganzen Satz weg, nicht nur die Zahl', () => {
    const raus = entferneErfundeneSaetze('Ein solides Geraet. Es leistet 750 W. Versand ab Lager.', ['750 W']);
    expect(raus).toBe('Ein solides Geraet. Versand ab Lager.');
  });

  it('laesst alles stehen, wenn nichts erfunden wurde', () => {
    const text = 'Ein solides Geraet. Versand ab Lager.';
    expect(entferneErfundeneSaetze(text, [])).toBe(text);
  });
});

describe('bereinigeFliesstext', () => {
  it('raeumt erfundene Angaben aus allen Teilen', () => {
    const { text, befund } = bereinigeFliesstext(
      {
        teaser: 'Kompakter Schrauber. Er leistet 750 W.',
        bullets: ['Arbeitet mit 18 V', 'Wiegt nur 2,3 kg'],
        anwendung: 'Fuer Montagearbeiten.',
        vorteile: 'Guenstiger als neu.',
        faq: [{ frage: 'Ist ein Akku dabei?', antwort: 'Der Lieferumfang ist nicht dokumentiert.' }],
      },
      eingabe(),
    );
    expect(befund.erfundeneAngaben).toEqual(expect.arrayContaining(['750 W', '2,3 kg']));
    expect(text.teaser).toBe('Kompakter Schrauber.');
    expect(text.bullets).toEqual(['Arbeitet mit 18 V']);
    expect(text.faq).toHaveLength(1);
  });

  it('macht einen leer geraeumten Abschnitt zu null', () => {
    const { text } = bereinigeFliesstext(
      { teaser: 'Leistet 750 W.', bullets: [], anwendung: '', vorteile: '', faq: [] },
      eingabe(),
    );
    // Lieber gar kein Teaser als ein erfundener.
    expect(text.teaser).toBeNull();
    expect(text.anwendung).toBeNull();
  });

  it('nimmt hoechstens fuenf Punkte', () => {
    const { text } = bereinigeFliesstext(
      { teaser: '', bullets: ['a', 'b', 'c', 'd', 'e', 'f'], anwendung: '', vorteile: '', faq: [] },
      eingabe(),
    );
    expect(text.bullets).toHaveLength(5);
  });

  it('kuerzt einen zu langen Punkt', () => {
    const { text } = bereinigeFliesstext(
      { teaser: '', bullets: ['x'.repeat(400)], anwendung: '', vorteile: '', faq: [] },
      eingabe(),
    );
    expect(text.bullets![0]).toHaveLength(200);
  });
});

describe('fliesstextAlsText', () => {
  it('nimmt Fragen und Antworten mit auf', () => {
    const t = fliesstextAlsText({ teaser: 'A', bullets: ['B'], faq: [{ frage: 'C', antwort: 'D' }] });
    expect(t).toContain('C');
    expect(t).toContain('D');
  });
});
