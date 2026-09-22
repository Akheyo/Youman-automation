import { describe, expect, it } from 'vitest'
import { CSV_STANDARD, baueCsv, feld, kodiere, zeile } from './csv'
import { spaltenPlan, standardPlan } from './felder'

describe('feld', () => {
  it('setzt Anfuehrungszeichen, sobald das Trennzeichen im Text steht', () => {
    expect(feld('Bagger; gebraucht', CSV_STANDARD)).toBe('"Bagger; gebraucht"')
  })

  it('verdoppelt Anfuehrungszeichen im Text', () => {
    expect(feld('Typ "A"', CSV_STANDARD)).toBe('"Typ ""A"""')
  })

  it('macht aus Umbruechen standardmaessig Leerzeichen', () => {
    // Ein Importer, der erst in Zeilen und dann in Spalten schneidet, zerlegt
    // sonst den halben Katalog.
    expect(feld('Zeile 1\nZeile 2', CSV_STANDARD)).toBe('Zeile 1 Zeile 2')
  })

  it('behaelt Umbrueche, wenn es ausdruecklich verlangt ist — dann aber in Anfuehrungszeichen', () => {
    expect(feld('A\nB', { ...CSV_STANDARD, umbrueche: 'behalten' })).toBe('"A\nB"')
  })
})

describe('zeile', () => {
  it('schreibt die Werte in der Reihenfolge des Plans', () => {
    const plan = spaltenPlan('Kategorie;Preis;Bezeichnung')
    expect(zeile({ titel: 'Bagger', preis: '1900,00', kategorie: '12' }, plan)).toBe('12;1900,00;Bagger')
  })

  it('laesst eine unbekannte Spalte leer, ohne den Rest zu verschieben', () => {
    const plan = spaltenPlan('Kategorie;Haendlerrabatt;Preis')
    expect(zeile({ kategorie: '12', preis: '1900,00' }, plan)).toBe('12;;1900,00')
  })
})

describe('baueCsv', () => {
  it('schreibt Kopfzeile und je Inserat eine Zeile', () => {
    const plan = spaltenPlan('Kategorie;Preis')
    const csv = baueCsv([{ kategorie: '1', preis: '10,00' }, { kategorie: '2', preis: '20,00' }], plan)
    expect(csv.split('\r\n').filter(Boolean)).toEqual(['Kategorie;Preis', '1;10,00', '2;20,00'])
  })

  it('endet mit einem Zeilenumbruch', () => {
    expect(baueCsv([{ kategorie: '1' }], spaltenPlan('Kategorie'))).toMatch(/\r\n$/)
  })

  it('haelt bei jeder Zeile dieselbe Spaltenzahl ein', () => {
    const plan = standardPlan()
    const csv = baueCsv([{ titel: 'A' }, {}], plan)
    const breiten = csv
      .trim()
      .split('\r\n')
      .map((z) => z.split(';').length)
    expect(new Set(breiten).size).toBe(1)
    expect(breiten[0]).toBe(plan.spalten.length)
  })
})

describe('kodiere', () => {
  it('stellt UTF-8 ein BOM voran', () => {
    const bytes = kodiere('Größe', 'utf-8')
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('rettet bei latin1 die Zeichen, die es dort nicht gibt', () => {
    const text = kodiere('Preis 10 €, „Typ" – neu', 'latin1').toString('latin1')
    expect(text).toContain('EUR')
    expect(text).not.toContain('€')
    expect(text).toContain('"Typ"')
  })
})
