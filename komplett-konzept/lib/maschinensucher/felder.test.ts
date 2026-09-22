import { describe, expect, it } from 'vitest'
import { FELDER, PFLICHTFELDER, normKopf, spaltenPlan, standardPlan } from './felder'

describe('Standardplan', () => {
  it('erreicht die von Maschinensucher genannte Mindestbreite von 32 Spalten', () => {
    expect(standardPlan().spalten.length).toBeGreaterThanOrEqual(32)
  })

  it('vergibt jeden Feldschluessel genau einmal', () => {
    const keys = FELDER.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('normKopf', () => {
  it('macht aus Schreibweisen dieselbe Vergleichsform', () => {
    expect(normKopf('Bild-URL 1')).toBe('bildurl1')
    expect(normKopf('Größe')).toBe('groesse')
    expect(normKopf(' MwSt. ')).toBe('mwst')
  })
})

describe('spaltenPlan mit fremder Kopfzeile', () => {
  it('ordnet unsere Felder auf die Spalten der Beispieldatei zu', () => {
    const plan = spaltenPlan('Anzeigennummer;Kategorie;Bezeichnung;Hersteller;Preis;Beschreibung;Land;PLZ;Ort;Bild 1')
    expect(plan.herkunft).toBe('beispieldatei')
    expect(plan.spalten.map((s) => s.feld)).toEqual([
      'inseratsnummer',
      'kategorie',
      'titel',
      'hersteller',
      'preis',
      'beschreibung',
      'land',
      'plz',
      'ort',
      'bild1',
    ])
  })

  it('nennt die Pflichtfelder, fuer die keine Spalte da ist', () => {
    const plan = spaltenPlan('Bezeichnung;Hersteller')
    expect(plan.fehlendePflicht).toContain('preis')
    expect(plan.fehlendePflicht).toContain('kategorie')
  })

  it('laesst eine unbekannte Spalte leer, statt die Zeile zu verschieben', () => {
    const plan = spaltenPlan('Kategorie;Haendlerrabatt;Preis')
    expect(plan.spalten[1].feld).toBeNull()
    expect(plan.unbelegt).toEqual(['Haendlerrabatt'])
  })

  it('verwechselt Bild 1 nicht mit Bild 10', () => {
    const plan = spaltenPlan('Bild 10;Bild 1')
    // "Bild 10" kennen wir nicht (wir liefern acht) — es bleibt leer, und das
    // Titelbild landet in der Spalte, die wirklich Bild 1 heisst.
    expect(plan.spalten[0].feld).toBeNull()
    expect(plan.spalten[1].feld).toBe('bild1')
  })

  it('faellt ohne Kopfzeile auf den Standard zurueck', () => {
    expect(spaltenPlan('').herkunft).toBe('standard')
    expect(spaltenPlan(null).herkunft).toBe('standard')
  })

  it('haelt Preis, Kategorie, Titel, Beschreibung und Standort fuer Pflicht', () => {
    for (const key of ['preis', 'kategorie', 'titel', 'beschreibung', 'plz', 'ort', 'land', 'bild1'] as const) {
      expect(PFLICHTFELDER).toContain(key)
    }
  })
})
