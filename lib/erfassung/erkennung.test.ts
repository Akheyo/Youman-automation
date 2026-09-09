import { describe, expect, it } from 'vitest';
import { istLesbar, notizZusammensetzen, type Erkennung } from './erkennung';

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
    merkmale: [],
    masseCm: null,
    typenschildGefunden: true,
    suchbegriffe: [],
    sicherheit: 'hoch',
    unsicherheiten: [],
    bilder: [],
    ...teil,
  };
}

describe('istLesbar', () => {
  it('laesst die Formate durch, die ausgewertet werden koennen', () => {
    expect(istLesbar('image/jpeg')).toBe(true);
    expect(istLesbar('image/png')).toBe(true);
    expect(istLesbar('image/webp')).toBe(true);
  });

  it('erkennt HEIC vom iPhone als nicht auswertbar', () => {
    expect(istLesbar('image/heic')).toBe(false);
    expect(istLesbar(null, 'abc/01-detail.heic')).toBe(false);
  });

  it('entscheidet ohne Content-Type nach der Endung', () => {
    expect(istLesbar(null, 'abc/01-detail.jpg')).toBe(true);
    expect(istLesbar('', 'abc/02-detail.png')).toBe(true);
  });

  it('ignoriert einen angehaengten Zeichensatz', () => {
    expect(istLesbar('image/jpeg; charset=binary')).toBe(true);
  });
});

describe('notizZusammensetzen', () => {
  it('schreibt die Schaeden untereinander', () => {
    const text = notizZusammensetzen(null, erkennung({ schaeden: ['Kratzer am Gehäuse', 'Gummifuß fehlt'] }));
    expect(text).toContain('Schäden:');
    expect(text).toContain('· Kratzer am Gehäuse');
    expect(text).toContain('· Gummifuß fehlt');
  });

  it('sagt ausdruecklich, wenn nichts zu sehen war', () => {
    expect(notizZusammensetzen(null, erkennung())).toContain('Schäden: keine sichtbaren');
  });

  it('laesst die Notiz eines Menschen unangetastet', () => {
    // Wer am Regal "Fernbedienung fehlt" eintippt, weiss etwas, das auf keinem
    // Foto zu sehen ist. Das darf die Maschine nie ueberschreiben.
    const text = notizZusammensetzen('Fernbedienung fehlt', erkennung());
    expect(text.startsWith('Fernbedienung fehlt')).toBe(true);
    expect(text).toContain('Zustand: gebraucht, Gebrauchsspuren');
  });

  it('stapelt sich bei wiederholter Erkennung nicht', () => {
    const einmal = notizZusammensetzen('Kabel dabei', erkennung({ schaeden: ['Rost'] }));
    const zweimal = notizZusammensetzen(einmal, erkennung({ schaeden: ['Rost am Fuß'] }));
    expect(zweimal.startsWith('Kabel dabei')).toBe(true);
    expect(zweimal.match(/Aus den Fotos erkannt/g)).toHaveLength(1);
    expect(zweimal).toContain('· Rost am Fuß');
    expect(zweimal).not.toContain('· Rost\n');
  });

  it('weist auf ein fehlendes Typenschild hin', () => {
    const text = notizZusammensetzen(null, erkennung({ typenschildGefunden: false }));
    expect(text).toContain('Kein lesbares Typenschild');
  });

  it('nennt den Lieferumfang, wenn etwas dabei lag', () => {
    expect(notizZusammensetzen(null, erkennung({ lieferumfang: ['Ladegerät', 'Koffer'] }))).toContain(
      'Lieferumfang: Ladegerät, Koffer',
    );
  });
});
