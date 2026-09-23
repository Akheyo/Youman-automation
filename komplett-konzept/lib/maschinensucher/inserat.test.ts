import { describe, expect, it } from 'vitest'
import {
  alsFliesstext,
  alterInTagen,
  baueInserat,
  findeKategorie,
  inseratsnummer,
  kuerze,
  netto,
  type Artikel,
  type Umgebung,
} from './inserat'

const JETZT = new Date('2026-09-22T09:00:00Z')

const UMGEBUNG: Umgebung = {
  nummernPraefix: 'KK-',
  preisIst: 'brutto',
  mwst: 19,
  land: 'DE',
  plz: '70565',
  ort: 'Stuttgart',
  ansprechpartner: 'Verkauf',
  telefon: '0711 000',
  email: 'maschinensucher@komplett-konzept.de',
  kategorieStandard: '9999',
  kategorieZuordnung: [{ wort: 'drehmaschine', kategorie: '1234' }],
  shopBasisUrl: 'https://shop.example.de',
  veraltetNachTagen: 3,
  bestandAltNachStunden: 24,
}

function artikel(teil: Partial<Artikel> = {}): Artikel {
  return {
    id: 'a1',
    plenty_variation_id: 90210,
    plenty_item_id: 65932,
    nummer: 'KK-2024-0815',
    ean: '2000000047119',
    titel: 'Weiler Drehmaschine Praktikant',
    beschreibung: '<p>Gut erhalten.</p>',
    hersteller: 'Weiler',
    modell: 'Praktikant',
    baujahr: '1998',
    zustand: 'Gebraucht',
    preis_brutto: '2261.00',
    waehrung: 'EUR',
    bestand: 1,
    bestand_am: '2026-09-22T08:30:00Z',
    gewicht_kg: '850.000',
    laenge_cm: '180.0',
    breite_cm: '80.0',
    hoehe_cm: '140.0',
    bilder: ['https://cdn.plenty/1.jpg'],
    kategorie: null,
    aktiv: true,
    gesehen_am: '2026-09-22T06:00:00Z',
    ...teil,
  }
}

describe('netto', () => {
  it('rechnet den Bruttopreis herunter', () => {
    // 2261 brutto / 1,19 = 1900,00 — auf Maschinensucher wird netto ausgezeichnet.
    expect(netto(2261, 19)).toBe(1900)
  })

  it('laesst den Preis stehen, wenn kein Satz gesetzt ist', () => {
    expect(netto(100, 0)).toBe(100)
  })
})

describe('kuerze', () => {
  it('schneidet an der Wortgrenze', () => {
    expect(kuerze('Weiler Drehmaschine Praktikant', 20)).toBe('Weiler Drehmaschine')
  })
})

describe('alsFliesstext', () => {
  it('macht aus HTML lesbaren Text mit Aufzaehlung', () => {
    expect(alsFliesstext('<p>Gut erhalten.</p><ul><li>Kratzer</li><li>Delle</li></ul>')).toBe(
      'Gut erhalten.\n\n· Kratzer\n· Delle',
    )
  })

  it('loest auch deutsche Entitaeten auf', () => {
    expect(alsFliesstext('<p>Fr&auml;se gr&ouml;&szlig;er</p>')).toBe('Fräse größer')
  })
})

describe('inseratsnummer', () => {
  it('nimmt die Variantennummer aus Plenty', () => {
    expect(inseratsnummer({ nummer: '4711', plenty_variation_id: 9 }, 'KK-')).toBe('KK-4711')
  })

  it('faellt auf die Varianten-ID zurueck, wenn keine Nummer da ist', () => {
    expect(inseratsnummer({ nummer: null, plenty_variation_id: 9 }, 'KK-')).toBe('KK-9')
  })

  it('setzt den Vorsatz nicht doppelt davor', () => {
    expect(inseratsnummer({ nummer: 'KK-2024-0815', plenty_variation_id: 9 }, 'KK-')).toBe('KK-2024-0815')
  })
})

describe('findeKategorie', () => {
  it('nimmt die von Hand gesetzte zuerst', () => {
    const a = artikel({ kategorie: '777' })
    expect(findeKategorie(a, UMGEBUNG)).toEqual({ kategorie: '777', herkunft: 'artikel' })
  })

  it('dann die Zuordnung ueber Suchworte', () => {
    expect(findeKategorie(artikel(), UMGEBUNG)).toEqual({ kategorie: '1234', herkunft: 'zuordnung' })
  })

  it('sonst die Auffangkategorie — und sagt es', () => {
    const a = artikel({ titel: 'Rollcontainer', hersteller: null, modell: null })
    expect(findeKategorie(a, UMGEBUNG)).toEqual({ kategorie: '9999', herkunft: 'standard' })
  })
})

describe('alterInTagen', () => {
  it('zaehlt die Tage seit dem letzten Abgleich', () => {
    expect(alterInTagen('2026-09-18T09:00:00Z', JETZT)).toBe(4)
  })

  it('meldet nichts, wenn nie abgeglichen wurde', () => {
    expect(alterInTagen(null, JETZT)).toBeNull()
  })
})

describe('baueInserat', () => {
  it('baut ein vollstaendiges Inserat ohne Maengel', () => {
    const { werte, maengel } = baueInserat(artikel(), UMGEBUNG, JETZT)
    expect(maengel).toEqual([])
    expect(werte.inseratsnummer).toBe('KK-2024-0815')
    expect(werte.preis).toBe('1900,00')
    expect(werte.preisart).toBe('netto')
    expect(werte.kategorie).toBe('1234')
    expect(werte.gewicht).toBe('850,0')
    expect(werte.bild1).toBe('https://cdn.plenty/1.jpg')
  })

  it('nimmt den Preis unveraendert, wenn Plenty netto fuehrt', () => {
    const { werte } = baueInserat(artikel(), { ...UMGEBUNG, preisIst: 'netto' }, JETZT)
    expect(werte.preis).toBe('2261,00')
  })

  it('haelt einen Artikel ohne Preis zurueck', () => {
    const { maengel } = baueInserat(artikel({ preis_brutto: null }), UMGEBUNG, JETZT)
    expect(maengel.join(' ')).toContain('Kein Preis')
  })

  it('haelt einen Artikel ohne Foto zurueck', () => {
    const { maengel } = baueInserat(artikel({ bilder: [] }), UMGEBUNG, JETZT)
    expect(maengel.join(' ')).toContain('Keine Fotos')
  })

  it('haelt zurueck, was in Plenty inaktiv ist', () => {
    const { maengel } = baueInserat(artikel({ aktiv: false }), UMGEBUNG, JETZT)
    expect(maengel.join(' ')).toContain('inaktiv')
  })

  it('haelt zurueck, was keinen Bestand mehr hat', () => {
    // Eine Anfrage zu einem verkauften Geraet kostet Vertrauen — deshalb ist
    // "Bestand 0" ein Grund, das Inserat nicht mehr mitzuliefern.
    const { maengel } = baueInserat(artikel({ bestand: 0 }), UMGEBUNG, JETZT)
    expect(maengel.join(' ')).toContain('Kein Bestand')
  })

  it('warnt, wenn der Bestand lange nicht geprueft wurde', () => {
    const alt = artikel({ bestand_am: '2026-09-20T09:00:00Z' })
    const { maengel, hinweise } = baueInserat(alt, UMGEBUNG, JETZT)
    expect(maengel).toEqual([])
    expect(hinweise.join(' ')).toContain('48 Stunden nicht geprüft')
  })

  it('sagt es, wenn der Bestand noch nie geprueft wurde', () => {
    const { hinweise } = baueInserat(artikel({ bestand_am: null }), UMGEBUNG, JETZT)
    expect(hinweise.join(' ')).toContain('noch nie geprüft')
  })

  it('meldet einen fehlenden Standort als Mangel der Einrichtung', () => {
    const { maengel } = baueInserat(artikel(), { ...UMGEBUNG, plz: '', ort: '' }, JETZT)
    expect(maengel.join(' ')).toContain('Kein Standort')
  })

  it('warnt bei veralteten Daten, haelt sie aber nicht auf', () => {
    const alt = artikel({ gesehen_am: '2026-09-10T09:00:00Z' })
    const { maengel, hinweise } = baueInserat(alt, UMGEBUNG, JETZT)
    expect(maengel).toEqual([])
    expect(hinweise.join(' ')).toContain('12 Tagen')
  })

  it('erfindet nichts, was in den Daten fehlt', () => {
    const ohne = artikel({ hersteller: null, baujahr: null, gewicht_kg: null })
    const { werte, hinweise } = baueInserat(ohne, UMGEBUNG, JETZT)
    expect(werte.hersteller).toBe('')
    expect(werte.baujahr).toBe('')
    expect(werte.gewicht).toBe('')
    expect(hinweise.join(' ')).toContain('Kein Baujahr')
  })

  it('nimmt hoechstens acht Fotos und sagt, wenn mehr da sind', () => {
    const viele = Array.from({ length: 11 }, (_, i) => `https://cdn.plenty/${i}.jpg`)
    const { werte, hinweise } = baueInserat(artikel({ bilder: viele }), UMGEBUNG, JETZT)
    expect(werte.bild8).toBe('https://cdn.plenty/7.jpg')
    expect(werte).not.toHaveProperty('bild9')
    expect(hinweise.join(' ')).toContain('ersten 8')
  })
})
