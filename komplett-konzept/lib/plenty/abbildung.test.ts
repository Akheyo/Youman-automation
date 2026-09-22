import { describe, expect, it } from 'vitest'
import { ausPlenty, bestandSumme, deutscherText, verkaufspreis, zustandText, type PlentyVariante } from './abbildung'

const OPTIONEN = { hersteller: new Map([[7, 'Weiler']]), preislisteId: null }

function variante(teil: Partial<PlentyVariante> = {}): PlentyVariante {
  return {
    id: 90210,
    itemId: 65932,
    number: 'KK-2024-0815',
    model: 'Praktikant',
    isActive: true,
    weightG: 850_000,
    lengthMM: 1800,
    widthMM: 800,
    heightMM: 1400,
    variationBarcodes: [{ code: '2000000047119' }],
    variationSalesPrices: [
      { salesPriceId: 1, price: 2261 },
      { salesPriceId: 4, price: 2600 },
    ],
    stock: [{ netStock: 1 }],
    item: {
      id: 65932,
      manufacturerId: 7,
      condition: 1,
      texts: [
        { lang: 'en', name1: 'Lathe', description: '<p>Used.</p>' },
        { lang: 'de', name1: 'Weiler Drehmaschine', description: '<p>Gut erhalten.</p>' },
      ],
    },
    ...teil,
  }
}

describe('deutscherText', () => {
  it('nimmt den deutschen Block', () => {
    expect(deutscherText(variante().item?.texts)?.name1).toBe('Weiler Drehmaschine')
  })

  it('nimmt den ersten, wenn es keinen deutschen gibt', () => {
    expect(deutscherText([{ lang: 'en', name1: 'Lathe' }])?.name1).toBe('Lathe')
  })

  it('kommt mit gar keinen Texten zurecht', () => {
    expect(deutscherText(null)).toBeNull()
    expect(deutscherText([])).toBeNull()
  })
})

describe('verkaufspreis', () => {
  it('nimmt ohne Vorgabe die kleinste Preislisten-ID', () => {
    expect(verkaufspreis(variante().variationSalesPrices, null)).toEqual({ preis: 2261, ausListe: 1 })
  })

  it('nimmt die vorgegebene Preisliste', () => {
    expect(verkaufspreis(variante().variationSalesPrices, 4)).toEqual({ preis: 2600, ausListe: 4 })
  })

  it('meldet nichts, wenn die vorgegebene Liste keinen Preis hat', () => {
    // Lieber kein Preis als der einer fremden Liste — sonst steht im Inserat
    // ein Preis, den niemand so beschlossen hat.
    expect(verkaufspreis(variante().variationSalesPrices, 99)).toEqual({ preis: null, ausListe: null })
  })

  it('ueberspringt Preise von 0', () => {
    expect(verkaufspreis([{ salesPriceId: 1, price: 0 }], null)).toEqual({ preis: null, ausListe: null })
  })
})

describe('bestandSumme', () => {
  it('zaehlt ueber alle Lager', () => {
    expect(bestandSumme(variante({ stock: [{ netStock: 2 }, { netStock: 3 }] }))).toBe(5)
  })

  it('faellt auf stockNet zurueck', () => {
    expect(bestandSumme(variante({ stock: null, stockNet: 4 }))).toBe(4)
  })

  it('unterscheidet "kein Bestand bekannt" von "Bestand 0"', () => {
    expect(bestandSumme(variante({ stock: null, stockNet: null }))).toBeNull()
    expect(bestandSumme(variante({ stock: [{ netStock: 0 }] }))).toBe(0)
  })
})

describe('zustandText', () => {
  it('uebersetzt die Plenty-Zustands-ID', () => {
    expect(zustandText(1)).toBe('Gebraucht')
    expect(zustandText({ id: 0 })).toBe('Neu')
  })

  it('erfindet nichts bei unbekannten Werten', () => {
    expect(zustandText(99)).toBeNull()
    expect(zustandText(null)).toBeNull()
  })
})

describe('ausPlenty', () => {
  it('rechnet Gramm in Kilogramm und Millimeter in Zentimeter', () => {
    // Der Fehler, den diese Zeile verhindert: "12500 kg" im Inserat, weil
    // Plenty Gramm fuehrt.
    const daten = ausPlenty(variante(), OPTIONEN)
    expect(daten.gewicht_kg).toBe(850)
    expect(daten.laenge_cm).toBe(180)
    expect(daten.breite_cm).toBe(80)
    expect(daten.hoehe_cm).toBe(140)
  })

  it('nimmt Titel und Text aus dem deutschen Block', () => {
    const daten = ausPlenty(variante(), OPTIONEN)
    expect(daten.titel).toBe('Weiler Drehmaschine')
    expect(daten.beschreibung).toBe('<p>Gut erhalten.</p>')
  })

  it('loest die Hersteller-ID in einen Namen auf', () => {
    expect(ausPlenty(variante(), OPTIONEN).hersteller).toBe('Weiler')
  })

  it('laesst den Hersteller leer, wenn die ID unbekannt ist', () => {
    const daten = ausPlenty(variante({ item: { manufacturerId: 999, texts: [] } }), OPTIONEN)
    expect(daten.hersteller).toBeNull()
  })

  it('nimmt den ersten brauchbaren Barcode', () => {
    expect(ausPlenty(variante(), OPTIONEN).ean).toBe('2000000047119')
  })

  it('haelt eine inaktive Variante als inaktiv fest', () => {
    expect(ausPlenty(variante({ isActive: false }), OPTIONEN).aktiv).toBe(false)
    // Fehlt das Feld, gilt der Artikel als aktiv — Plenty liefert es nicht
    // in jeder Ausbaustufe mit.
    expect(ausPlenty(variante({ isActive: null }), OPTIONEN).aktiv).toBe(true)
  })

  it('kommt mit einer nackten Variante zurecht', () => {
    const daten = ausPlenty({ id: 1 }, OPTIONEN)
    expect(daten.plenty_variation_id).toBe(1)
    expect(daten.titel).toBeNull()
    expect(daten.preis_brutto).toBeNull()
    expect(daten.gewicht_kg).toBeNull()
    expect(daten.bestand).toBeNull()
  })
})
