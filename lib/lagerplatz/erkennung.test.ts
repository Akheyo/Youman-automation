import { describe, expect, it } from 'vitest';
import { besterTreffer, findeLagerplaetze, gleicherOrt, klartextAus } from './erkennung';
import { alsCsv, bewerteVariante, fasseZusammen } from './befund';

/** Alle Beispiele stammen aus echten Plenty-Daten (Stichprobe 1.000 Artikel). */

describe('findeLagerplaetze — lange Form (Plenty-Lagerort)', () => {
  it('liest den Standardfall mit Kiste', () => {
    const [t] = findeLagerplaetze('H2/R7/EA F08-K71');
    expect(t.code).toBe('H2/R7/EA F08-K71');
    expect(t.form).toBe('lang');
    expect(t.sicherheit).toBe('sicher');
    expect(t.segment).toEqual({ halle: 2, regal: '7', ebene: 'A', fach: '08', kiste: 'K71' });
    expect(t.klartext).toBe('Halle 2 · Regal 7 · Ebene A · Fach 8 · Kiste 71');
  });

  it('versteht „-0" als „keine Kiste"', () => {
    const [t] = findeLagerplaetze('H1/R1/EB F12-0');
    expect(t.segment.kiste).toBe('0');
    expect(t.code).toBe('H1/R1/EB F12-0');
    expect(t.klartext).toBe('Halle 1 · Regal 1 · Ebene B · Fach 12');
  });

  it('kommt mit KTL-Regalen zurecht', () => {
    expect(findeLagerplaetze('H6/R2KTL/ED F01-0')[0].segment.regal).toBe('2KTL');
    expect(findeLagerplaetze('H5/RKTL/EA F01-K071')[0].segment.regal).toBe('KTL');
  });

  it('behält einen unklaren Zusatz, statt ihn zu verwerfen', () => {
    const [t] = findeLagerplaetze('H5/R10/EE F22-2');
    expect(t.code).toBe('H5/R10/EE F22-2');
    expect(t.segment.kiste).toBe('2');
    expect(t.klartext).toBe('Halle 5 · Regal 10 · Ebene E · Fach 22 · Zusatz 2');
  });

  it('kommt mit Z-Ebenen zurecht', () => {
    expect(findeLagerplaetze('H1/R11/EAZ F02-1')[0].segment.ebene).toBe('AZ');
    expect(findeLagerplaetze('H2/R10/EBZ F01-0')[0].segment.ebene).toBe('BZ');
  });

  it('kommt mit Buchstaben im Fach zurecht („FM1")', () => {
    const [t] = findeLagerplaetze('H1/R13/EC FM1-2');
    expect(t.code).toBe('H1/R13/EC FM1-2');
    expect(t.segment.fach).toBe('M1');
  });

  it('findet mehrere Lagerorte in einem Feld', () => {
    const codes = findeLagerplaetze('H1/R8/EA F20-K10,H1/R8/EA F20-K19').map((t) => t.code);
    expect(codes).toEqual(['H1/R8/EA F20-K10', 'H1/R8/EA F20-K19']);
  });
});

describe('findeLagerplaetze — kurze Form (Variantennummer, Freitext)', () => {
  it('normiert die Kurzform auf die Plenty-Schreibweise', () => {
    const [t] = findeLagerplaetze('NEW-14158-H3R6B10_CK');
    expect(t.code).toBe('H3/R6/EB F10-0');
    expect(t.form).toBe('kurz');
    expect(t.grund).toBe('aus Freitext gelesen');
  });

  it('liest Kleinschreibung', () => {
    expect(findeLagerplaetze('wh25092014_7_h1r6a10')[0].code).toBe('H1/R6/EA F10-0');
  });

  it('nimmt die Kiste mit', () => {
    expect(findeLagerplaetze('H2R7A15K30-1_CK')[0].code).toBe('H2/R7/EA F15-K30');
  });

  it('versteht mehrere Kisten am selben Fach („K2+3")', () => {
    const codes = findeLagerplaetze('H1R5A12K2+3_07.05.2014').map((t) => t.code);
    expect(codes).toEqual(['H1/R5/EA F12-K02', 'H1/R5/EA F12-K03']);
  });

  it('versteht ausgeschriebene Ebenen', () => {
    expect(findeLagerplaetze('Lagerplatz: Halle 2 Regal 4 B 1')[0].code).toBe('H2/R4/EB F01-0');
  });

  it('findet den Code mitten in einer Beschreibung', () => {
    const t = findeLagerplaetze('Drehmaschine, Baujahr 1998. Lagerplatz H2R11B3 — Abholung nach Absprache.');
    expect(t[0].code).toBe('H2/R11/EB F03-0');
  });

  it('meldet unübliche Ebenen als unsicher', () => {
    const [t] = findeLagerplaetze('H1R6X12');
    expect(t?.sicherheit ?? 'kein Treffer').toBe('kein Treffer');
  });

  it('erzeugt keine Treffer aus Fließtext ohne Muster', () => {
    expect(findeLagerplaetze('Guter Zustand, im Lager geprüft, sofort verfügbar.')).toEqual([]);
    expect(findeLagerplaetze('')).toEqual([]);
  });

  it('hält Maßangaben nicht für Lagerplätze', () => {
    expect(findeLagerplaetze('Karton L120B60H90')).toEqual([]);
    expect(findeLagerplaetze('Abmessungen 220x80x60cm')).toEqual([]);
  });

  it('liest dieselbe Stelle nicht doppelt als lang und kurz', () => {
    expect(findeLagerplaetze('H2/R7/EA F08-K71')).toHaveLength(1);
  });
});

describe('besterTreffer', () => {
  it('zieht den echten Lagerort dem Texthinweis vor', () => {
    const beste = besterTreffer(findeLagerplaetze('H1R6A10 … laut Plenty H2/R7/EA F08-K71'));
    expect(beste?.code).toBe('H2/R7/EA F08-K71');
    expect(beste?.form).toBe('lang');
  });
});

describe('gleicherOrt', () => {
  it('ignoriert die Kiste beim Vergleich', () => {
    expect(gleicherOrt('H1/R6/EA F10-0', 'H1/R6/EA F10-K07')).toBe(true);
    expect(gleicherOrt('H1/R6/EA F10-0', 'H1/R6/EA F11-0')).toBe(false);
  });
});

describe('klartextAus', () => {
  it('lässt die Kiste weg, wenn es keine gibt', () => {
    expect(klartextAus({ halle: 1, regal: '8KTL', ebene: 'CZ', fach: '5', kiste: null }))
      .toBe('Halle 1 · Regal 8KTL · Ebene CZ · Fach 5');
  });
});

describe('bewerteVariante', () => {
  const basis = { variationId: 1, itemId: 10 };

  it('nimmt den Lagerplatz aus der Variantennummer', () => {
    const b = bewerteVariante({ ...basis, nummer: 'NEW-14158-H3R6B10_CK' });
    expect(b.code).toBe('H3/R6/EB F10-0');
    expect(b.quelle).toBe('Variantennummer');
    expect(b.status).toBe('gefunden');
  });

  it('greift auf die Beschreibung zurück, wenn die Nummer nichts hergibt', () => {
    const b = bewerteVariante({ ...basis, nummer: '100234', beschreibung: 'Standort: H2R4B1' });
    expect(b.code).toBe('H2/R4/EB F01-0');
    expect(b.quelle).toBe('Beschreibung');
  });

  it('meldet zwei verschiedene Plätze als Konflikt', () => {
    const b = bewerteVariante({ ...basis, nummer: 'H1R8A13', beschreibung: 'jetzt H2/R3/EA F11-0' });
    expect(b.status).toBe('konflikt');
    expect(b.hinweis).toMatch(/H2\/R3\/EA F11-0/);
  });

  it('meldet kein-treffer, wenn nichts zu finden ist', () => {
    const b = bewerteVariante({ ...basis, nummer: 'NEW-43261', beschreibung: 'Sehr guter Zustand' });
    expect(b.status).toBe('kein-treffer');
    expect(b.code).toBeNull();
  });

  it('reicht Bestand und Lager durch', () => {
    const b = bewerteVariante({ ...basis, nummer: 'H1R6A10', bestand: 5, bestandPhysisch: 5, lager: 'Haupthalle' });
    expect(b.bestand).toBe(5);
    expect(b.lager).toBe('Haupthalle');
  });
});

describe('fasseZusammen', () => {
  it('zählt Status und verschiedene Lagerplätze', () => {
    const befunde = [
      bewerteVariante({ variationId: 1, itemId: 1, nummer: 'H1R6A10' }),
      bewerteVariante({ variationId: 2, itemId: 2, nummer: 'H1R6A10' }),
      bewerteVariante({ variationId: 3, itemId: 3, nummer: 'H2/R7/EA F08-K71' }),
      bewerteVariante({ variationId: 4, itemId: 4, nummer: '4711' }),
    ];
    const z = fasseZusammen(befunde);
    expect(z.gesamt).toBe(4);
    expect(z.gefunden).toBe(3);
    expect(z.ohneTreffer).toBe(1);
    expect(z.plaetze[0]).toEqual({ code: 'H1/R6/EA F10-0', klartext: 'Halle 1 · Regal 6 · Ebene A · Fach 10', anzahl: 2 });
  });
});

describe('alsCsv', () => {
  it('schreibt Kopfzeile und maskiert Semikolons', () => {
    const csv = alsCsv([bewerteVariante({ variationId: 1, itemId: 2, nummer: 'H1R6A10', name: 'Regal; alt' })]);
    const [kopf, zeile] = csv.split('\r\n');
    expect(kopf.startsWith('Variante-ID;Artikel-ID')).toBe(true);
    expect(zeile).toContain('"Regal; alt"');
  });
});
