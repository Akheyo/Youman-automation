import { describe, expect, it } from 'vitest';
import { brauchtUebersetzung, quellFingerabdruck, type SpiegelZeile } from './spiegel';

const zeile = (teil: Partial<SpiegelZeile> = {}): SpiegelZeile => ({
  variationId: 1,
  itemId: 2,
  mpItemId: 'm1',
  fingerabdruck: 'F',
  quellFingerabdruck: quellFingerabdruck('Bohrhammer', 'Gebraucht, funktioniert.'),
  titelNl: 'Boorhamer',
  beschreibungNl: 'Gebruikt, werkt.',
  status: 'online',
  fehler: null,
  ...teil,
});

describe('quellFingerabdruck', () => {
  it('ist gleich fuer denselben Text', () => {
    expect(quellFingerabdruck('A', 'B')).toBe(quellFingerabdruck('A', 'B'));
  });

  it('aendert sich mit dem Titel und mit der Beschreibung', () => {
    expect(quellFingerabdruck('A', 'B')).not.toBe(quellFingerabdruck('A2', 'B'));
    expect(quellFingerabdruck('A', 'B')).not.toBe(quellFingerabdruck('A', 'B2'));
  });

  it('stoert sich nicht an umgebenden Leerzeichen', () => {
    expect(quellFingerabdruck(' A ', ' B ')).toBe(quellFingerabdruck('A', 'B'));
  });
});

describe('brauchtUebersetzung', () => {
  const quelle = quellFingerabdruck('Bohrhammer', 'Gebraucht, funktioniert.');

  it('ja, wenn es die Zeile noch nicht gibt', () => {
    expect(brauchtUebersetzung(quelle, undefined)).toBe(true);
    expect(brauchtUebersetzung(quelle, null)).toBe(true);
  });

  it('ja, wenn die Uebersetzung fehlt', () => {
    expect(brauchtUebersetzung(quelle, zeile({ titelNl: null }))).toBe(true);
    expect(brauchtUebersetzung(quelle, zeile({ beschreibungNl: null }))).toBe(true);
  });

  it('ja, wenn sich der deutsche Text geaendert hat', () => {
    expect(brauchtUebersetzung(quellFingerabdruck('Bohrhammer neu', 'Anderer Text.'), zeile())).toBe(true);
  });

  it('nein, wenn alles steht — sonst kostet jeder Lauf erneut', () => {
    expect(brauchtUebersetzung(quelle, zeile())).toBe(false);
  });
});
