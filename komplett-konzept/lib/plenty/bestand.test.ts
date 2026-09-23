import { describe, expect, it } from 'vitest'
import { NULLUNG_MINDEST, fasseZusammen, pruefeNullung } from './bestand'

describe('fasseZusammen', () => {
  it('zaehlt den Bestand einer Variante ueber alle Lager', () => {
    const summen = fasseZusammen([
      { variationId: 1, netStock: 2 },
      { variationId: 1, netStock: 3 },
      { variationId: 2, netStock: 1 },
    ])
    expect(summen.get(1)).toBe(5)
    expect(summen.get(2)).toBe(1)
  })

  it('nimmt den NETTO-Bestand — reserviert ist schon verkauft', () => {
    const summen = fasseZusammen([{ variationId: 1, netStock: 0, physicalStock: 3 }])
    expect(summen.get(1)).toBe(0)
  })

  it('faellt auf den physischen Bestand zurueck, wenn es keinen netto gibt', () => {
    const summen = fasseZusammen([{ variationId: 1, netStock: null, physicalStock: 2 }])
    expect(summen.get(1)).toBe(2)
  })

  it('ueberspringt Zeilen ohne Variante', () => {
    const summen = fasseZusammen([{ variationId: null, netStock: 5 }, { netStock: 5 }])
    expect(summen.size).toBe(0)
  })

  it('behaelt auch negative Bestaende — sie sind ein Befund, kein Nichts', () => {
    expect(fasseZusammen([{ variationId: 1, netStock: -2 }]).get(1)).toBe(-2)
  })
})

describe('pruefeNullung', () => {
  it('setzt nach einem abgebrochenen Lauf nichts auf Null', () => {
    // Ein halb gelesener Bestand sieht aus wie ein leeres Lager.
    const befund = pruefeNullung({ markiert: 100, wuerdenGenullt: 40, vollstaendig: false })
    expect(befund.erlaubt).toBe(false)
    expect(befund.meldung).toContain('nicht durchgelaufen')
  })

  it('laesst den Normalfall durch', () => {
    const befund = pruefeNullung({ markiert: 100, wuerdenGenullt: 3, vollstaendig: true })
    expect(befund.erlaubt).toBe(true)
    expect(befund.meldung).toBeNull()
  })

  it('haelt einen Einbruch zurueck', () => {
    const befund = pruefeNullung({ markiert: 100, wuerdenGenullt: 60, vollstaendig: true })
    expect(befund.erlaubt).toBe(false)
    expect(befund.meldung).toContain('60 von 100')
  })

  it('greift bei wenigen Artikeln nicht', () => {
    // Bei vier verkauften Geraeten ist "alle vier weg" ein guter Tag.
    const befund = pruefeNullung({ markiert: 4, wuerdenGenullt: NULLUNG_MINDEST - 1, vollstaendig: true })
    expect(befund.erlaubt).toBe(true)
  })

  it('laesst durch, wenn gar nichts genullt wuerde', () => {
    expect(pruefeNullung({ markiert: 0, wuerdenGenullt: 0, vollstaendig: true }).erlaubt).toBe(true)
  })
})
