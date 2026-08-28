import { describe, expect, it } from 'vitest';
import { besterTreffer, findeLagerplaetze, klartextAus } from './erkennung';
import { alsCsv, bewerteVariante, fasseZusammen } from './befund';

describe('findeLagerplaetze', () => {
  it('erkennt die Standardform H6R5A7', () => {
    const [t] = findeLagerplaetze('H6R5A7');
    expect(t.code).toBe('H6R5A7');
    expect(t.sicherheit).toBe('sicher');
    expect(t.klartext).toBe('Halle 6 · Regal 5 · Ablage 7');
  });

  it('ist tolerant bei Trennzeichen, Kleinschreibung und führenden Nullen', () => {
    for (const text of ['h6-r5-a7', 'H6 R5 A7', 'H.6/R.5_A.7', 'H06R05A07']) {
      expect(findeLagerplaetze(text)[0]?.code, text).toBe('H6R5A7');
    }
  });

  it('versteht ausgeschriebene Ebenen', () => {
    const [t] = findeLagerplaetze('Lagerplatz: Halle 6 Regal 5 Ablage 7');
    expect(t.code).toBe('H6R5A7');
    expect(t.sicherheit).toBe('sicher');
  });

  it('findet den Code mitten in einer Beschreibung', () => {
    const text = 'Gebrauchte Drehmaschine, Baujahr 1998.\nLagerplatz H2R11F3 — Abholung nach Absprache.';
    const [t] = findeLagerplaetze(text);
    expect(t.code).toBe('H2R11F3');
  });

  it('findet den Code in einer Variantennummer', () => {
    expect(findeLagerplaetze('KK-2024-0815-H6R5A7')[0]?.code).toBe('H6R5A7');
  });

  it('räumt HTML aus Beschreibungen weg', () => {
    expect(findeLagerplaetze('<p>Lagerplatz:<br/><b>H6R5A7</b></p>')[0]?.code).toBe('H6R5A7');
  });

  it('meldet zwei Ebenen als unsicher statt sie zu verwerfen', () => {
    const [t] = findeLagerplaetze('R5A7');
    expect(t.code).toBe('R5A7');
    expect(t.sicherheit).toBe('unsicher');
    expect(t.grund).toMatch(/zwei Ebenen/);
  });

  it('meldet unbekannte Ebenen als unsicher', () => {
    const [t] = findeLagerplaetze('X1Y2Z3');
    expect(t.sicherheit).toBe('unsicher');
    expect(t.grund).toMatch(/unbekannte Ebene/);
  });

  it('hält Maßangaben für Maßangaben, nicht für Lagerplätze', () => {
    const [t] = findeLagerplaetze('Karton L120B60H90');
    expect(t.sicherheit).toBe('ignoriert');
    expect(besterTreffer(findeLagerplaetze('Karton L120B60H90'))).toBeNull();
  });

  it('erzeugt keine Treffer aus Fließtext ohne Muster', () => {
    expect(findeLagerplaetze('Guter Zustand, im Lager geprüft, sofort verfügbar.')).toEqual([]);
    expect(findeLagerplaetze('')).toEqual([]);
  });

  it('fasst denselben Code nur einmal zusammen', () => {
    expect(findeLagerplaetze('H6R5A7 … siehe auch h6 r5 a7')).toHaveLength(1);
  });

  it('erkennt mehrere verschiedene Codes', () => {
    const codes = findeLagerplaetze('H6R5A7 und H2R1F4').map((t) => t.code);
    expect(codes).toEqual(['H6R5A7', 'H2R1F4']);
  });

  it('bevorzugt den sicheren Treffer vor dem unsicheren', () => {
    const beste = besterTreffer(findeLagerplaetze('A4 B5 — Lagerplatz H6R5A7'));
    expect(beste?.code).toBe('H6R5A7');
  });

  it('klartextAus benennt bekannte Ebenen', () => {
    expect(klartextAus([{ schluessel: 'H', nummer: 1 }, { schluessel: 'F', nummer: 2 }])).toBe('Halle 1 · Fach 2');
  });
});

describe('bewerteVariante', () => {
  const basis = { variationId: 1, itemId: 10 };

  it('nimmt den Lagerplatz aus der Variantennummer', () => {
    const b = bewerteVariante({ ...basis, nummer: 'KK-H6R5A7' });
    expect(b.code).toBe('H6R5A7');
    expect(b.quelle).toBe('Variantennummer');
    expect(b.status).toBe('gefunden');
  });

  it('greift auf die Beschreibung zurück, wenn die Nummer nichts hergibt', () => {
    const b = bewerteVariante({ ...basis, nummer: '100234', beschreibung: 'Standort: Halle 2 Regal 4 Fach 1' });
    expect(b.code).toBe('H2R4F1');
    expect(b.quelle).toBe('Beschreibung');
  });

  it('meldet widersprüchliche Angaben als Konflikt', () => {
    const b = bewerteVariante({ ...basis, nummer: 'H6R5A7', beschreibung: 'Lagerplatz H1R1A1' });
    expect(b.status).toBe('konflikt');
    expect(b.hinweis).toMatch(/H6R5A7/);
    expect(b.code).toBe('H6R5A7'); // Variantennummer hat Vorrang
  });

  it('zieht einen sicheren Treffer einem unsicheren vor, auch aus späterem Feld', () => {
    const b = bewerteVariante({ ...basis, nummer: 'R5A7', beschreibung: 'Lagerplatz H6R5A7' });
    expect(b.code).toBe('H6R5A7');
    expect(b.status).toBe('gefunden');
  });

  it('meldet kein-treffer, wenn nichts zu finden ist', () => {
    const b = bewerteVariante({ ...basis, nummer: '100234', beschreibung: 'Sehr guter Zustand' });
    expect(b.status).toBe('kein-treffer');
    expect(b.code).toBeNull();
  });

  it('erklärt, wenn nur Maßangaben gefunden wurden', () => {
    const b = bewerteVariante({ ...basis, beschreibung: 'Abmessungen L120B60H90' });
    expect(b.status).toBe('kein-treffer');
    expect(b.hinweis).toMatch(/Maßangaben/);
  });
});

describe('fasseZusammen', () => {
  it('zählt Status und verschiedene Lagerplätze', () => {
    const befunde = [
      bewerteVariante({ variationId: 1, itemId: 1, nummer: 'H6R5A7' }),
      bewerteVariante({ variationId: 2, itemId: 2, nummer: 'H6R5A7' }),
      bewerteVariante({ variationId: 3, itemId: 3, nummer: 'H1R1A1' }),
      bewerteVariante({ variationId: 4, itemId: 4, nummer: '4711' }),
    ];
    const z = fasseZusammen(befunde);
    expect(z.gesamt).toBe(4);
    expect(z.gefunden).toBe(3);
    expect(z.ohneTreffer).toBe(1);
    expect(z.plaetze[0]).toEqual({ code: 'H6R5A7', klartext: 'Halle 6 · Regal 5 · Ablage 7', anzahl: 2 });
    expect(z.plaetze).toHaveLength(2);
  });
});

describe('alsCsv', () => {
  it('schreibt Kopfzeile und maskiert Semikolons', () => {
    const csv = alsCsv([bewerteVariante({ variationId: 1, itemId: 2, nummer: 'H6R5A7', name: 'Regal; alt' })]);
    const [kopf, zeile] = csv.split('\r\n');
    expect(kopf.startsWith('Variante-ID;Artikel-ID')).toBe(true);
    expect(zeile).toContain('"Regal; alt"');
    expect(zeile).toContain('H6R5A7');
  });
});
