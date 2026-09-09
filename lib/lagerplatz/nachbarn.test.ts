/**
 * Testet die Suchlogik für alternative Lagerplätze.
 *
 * Wichtigster Punkt: Die Größenprobe muss greifen. Wenn eine Maschine als
 * bester Kandidat eine Kleinteilkiste bekommt, schickt das Werkzeug Leute
 * zum falschen Regal — genau das soll es verhindern.
 */
import { describe, expect, it } from 'vitest';
import {
  bewerte,
  einwandGroesse,
  groessenklasse,
  idNachbarn,
  laufzettel,
  regalNachbarn,
  segmentAus,
  type Hinweis,
} from './nachbarn';

describe('idNachbarn', () => {
  it('liefert die nächsten IDs zuerst', () => {
    expect(idNachbarn(100, 3)).toEqual([99, 101, 98, 102, 97, 103]);
  });

  it('lässt IDs unter 1 weg', () => {
    expect(idNachbarn(2, 3)).toEqual([1, 3, 4, 5]);
  });

  it('gibt bei Spanne 0 nichts zurück', () => {
    expect(idNachbarn(100, 0)).toEqual([]);
  });
});

describe('segmentAus', () => {
  it('zerlegt die lange Form', () => {
    expect(segmentAus('H2/R7/EA F08-K71')).toMatchObject({
      halle: 2,
      regal: '7',
      ebene: 'A',
      fach: '08',
      kiste: 'K71',
    });
  });

  it('gibt bei Unsinn null zurück', () => {
    expect(segmentAus('Werkbank blau')).toBeNull();
  });
});

describe('regalNachbarn', () => {
  it('findet das Fach daneben', () => {
    const codes = regalNachbarn('H2/R7/EA F08-K71').map((n) => n.code);
    expect(codes).toContain('H2/R7/EA F07-K71');
    expect(codes).toContain('H2/R7/EA F09-K71');
  });

  it('findet die Kiste daneben', () => {
    const codes = regalNachbarn('H2/R7/EA F08-K71').map((n) => n.code);
    expect(codes).toContain('H2/R7/EA F08-K70');
    expect(codes).toContain('H2/R7/EA F08-K72');
  });

  it('findet die Ebene darüber und darunter', () => {
    const codes = regalNachbarn('H2/R7/EB F08-K71', { fach: 0, kiste: 0, ebene: 1 }).map((n) => n.code);
    expect(codes).toEqual(expect.arrayContaining(['H2/R7/EA F08-K71', 'H2/R7/EC F08-K71']));
  });

  it('nennt den eigenen Platz nicht als Nachbarn', () => {
    const codes = regalNachbarn('H2/R7/EA F08-K71').map((n) => n.code);
    expect(codes).not.toContain('H2/R7/EA F08-K71');
  });

  it('sortiert nach Abstand', () => {
    const abstaende = regalNachbarn('H2/R7/EA F08-K71', { fach: 2, kiste: 0, ebene: 0 }).map((n) => n.abstand);
    expect(abstaende).toEqual([...abstaende].sort((a, b) => a - b));
  });

  it('erfindet keine Kisten, wo der Platz keine führt', () => {
    const codes = regalNachbarn('H2/R7/EA F08-0').map((n) => n.code);
    expect(codes.every((c) => c.endsWith('-0'))).toBe(true);
  });

  it('gibt bei unlesbarem Code nichts zurück', () => {
    expect(regalNachbarn('Werkbank')).toEqual([]);
  });
});

describe('groessenklasse', () => {
  it('erkennt ein Kleinteil', () => {
    expect(groessenklasse({ gewichtG: 250, breiteMM: 100, laengeMM: 150, hoeheMM: 40 })).toBe('kleinteil');
  });

  it('erkennt ein Großteil am Gewicht', () => {
    expect(groessenklasse({ gewichtG: 82_000 })).toBe('grossteil');
  });

  it('erkennt ein Großteil an der Kantenlänge', () => {
    expect(groessenklasse({ gewichtG: 4_000, breiteMM: 1200, laengeMM: 300, hoeheMM: 300 })).toBe('grossteil');
  });

  it('sagt ohne Angaben nichts aus', () => {
    expect(groessenklasse({})).toBe('unbekannt');
    expect(groessenklasse({ gewichtG: 0, breiteMM: null })).toBe('unbekannt');
  });
});

describe('einwandGroesse', () => {
  it('widerspricht einer Maschine in der Kleinteilkiste', () => {
    expect(einwandGroesse('grossteil', 'H2/R7/EA F08-K71')).toMatch(/Kleinteilkiste/);
  });

  it('widerspricht einem Kleinteil auf dem Palettenplatz', () => {
    expect(einwandGroesse('kleinteil', 'H2/R7/EA F08-P16')).toMatch(/Palettenplatz/);
  });

  it('widerspricht Schwerem in hohen Ebenen', () => {
    expect(einwandGroesse('grossteil', 'H2/R7/EF F08-0')).toMatch(/Ebene F/);
  });

  it('schweigt, wenn die Größe unbekannt ist', () => {
    expect(einwandGroesse('unbekannt', 'H2/R7/EA F08-K71')).toBeNull();
  });

  it('schweigt bei passendem Platz', () => {
    expect(einwandGroesse('kleinteil', 'H2/R7/EA F08-K71')).toBeNull();
  });
});

describe('bewerte', () => {
  const hinweis = (code: string, signal: Hinweis['signal'], abstand?: number): Hinweis => ({
    code,
    signal,
    text: `${signal} auf ${code}`,
    abstand: abstand ?? null,
  });

  it('stellt das stärkere Signal nach oben', () => {
    const out = bewerte([hinweis('H1/R1/EA F01-0', 'regal-nachbar'), hinweis('H2/R2/EA F02-0', 'eigener-text')]);
    expect(out[0].code).toBe('H2/R2/EA F02-0');
  });

  it('verstärkt einen Platz, den mehrere Signale nennen', () => {
    const einzeln = bewerte([hinweis('H1/R1/EA F01-0', 'id-nachbar')])[0].punkte;
    const mehrfach = bewerte([
      hinweis('H1/R1/EA F01-0', 'id-nachbar'),
      hinweis('H1/R1/EA F01-0', 'einlagerung'),
    ])[0].punkte;
    expect(mehrfach).toBeGreaterThan(einzeln);
  });

  it('lässt schwache Signale einen starken nicht überholen', () => {
    const viele = bewerte([
      hinweis('H1/R1/EA F01-0', 'regal-nachbar', 1),
      hinweis('H1/R1/EA F01-0', 'regal-nachbar', 2),
      hinweis('H1/R1/EA F01-0', 'regal-nachbar', 3),
      hinweis('H1/R1/EA F01-0', 'platztausch'),
    ]);
    const stark = bewerte([hinweis('H2/R2/EA F02-0', 'eigener-bestand')]);
    expect(stark[0].punkte).toBeGreaterThan(viele[0].punkte);
  });

  it('dämpft Hinweise mit größerem Abstand', () => {
    const out = bewerte([hinweis('H1/R1/EA F01-0', 'id-nachbar', 1), hinweis('H2/R2/EA F02-0', 'id-nachbar', 3)]);
    expect(out[0].code).toBe('H1/R1/EA F01-0');
  });

  it('wertet einen Platz ab, der zur Größe nicht passt', () => {
    const ohne = bewerte([hinweis('H1/R1/EA F01-K05', 'id-nachbar')])[0];
    const mit = bewerte([hinweis('H1/R1/EA F01-K05', 'id-nachbar')], { klasse: 'grossteil' })[0];
    expect(mit.punkte).toBeLessThan(ohne.punkte);
    expect(mit.einwaende[0]).toMatch(/Kleinteilkiste/);
  });

  it('markiert Plätze, die es in Plenty nicht gibt', () => {
    const out = bewerte([hinweis('H1/R1/EA F01-0', 'id-nachbar')], { bekannteOrte: new Map() });
    expect(out[0].existiert).toBe(false);
    expect(out[0].einwaende.join(' ')).toMatch(/gibt es in Plenty nicht/);
  });

  it('reicht die Lagerort-ID durch, wenn der Platz existiert', () => {
    const out = bewerte([hinweis('H1/R1/EA F01-0', 'id-nachbar')], {
      bekannteOrte: new Map([['H1/R1/EA F01-0', 4711]]),
    });
    expect(out[0].lagerortId).toBe(4711);
    expect(out[0].existiert).toBe(true);
  });

  it('übersteht leere Eingaben', () => {
    expect(bewerte([])).toEqual([]);
  });
});

describe('laufzettel', () => {
  it('sortiert nach Laufweg statt nach Punkten', () => {
    const kandidaten = bewerte([
      { code: 'H2/R1/EA F01-0', signal: 'eigener-text', text: '' },
      { code: 'H1/R9/EA F01-0', signal: 'regal-nachbar', text: '' },
      { code: 'H1/R2/EB F10-0', signal: 'id-nachbar', text: '' },
      { code: 'H1/R2/EB F02-0', signal: 'id-nachbar', text: '' },
    ]);
    expect(laufzettel(kandidaten).map((k) => k.code)).toEqual([
      'H1/R2/EB F02-0',
      'H1/R2/EB F10-0',
      'H1/R9/EA F01-0',
      'H2/R1/EA F01-0',
    ]);
  });
});
