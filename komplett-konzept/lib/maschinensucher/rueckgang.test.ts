import { describe, expect, it } from 'vitest'
import { FREIGABE_STUNDEN, freigabeBis, pruefeRueckgang } from './rueckgang'

const JETZT = new Date('2026-09-22T02:00:00Z')

describe('pruefeRueckgang', () => {
  it('laesst den ersten Lauf durch', () => {
    expect(pruefeRueckgang({ jetzt: 0, zuletzt: null, freiBis: null, zeitpunkt: JETZT }).blockiert).toBe(false)
  })

  it('greift unterhalb der Schwelle nicht', () => {
    // Bei sechs Inseraten ist "nur noch zwei" ein normaler Dienstag.
    expect(pruefeRueckgang({ jetzt: 2, zuletzt: 6, freiBis: null, zeitpunkt: JETZT }).blockiert).toBe(false)
  })

  it('laesst normale Schwankungen durch', () => {
    expect(pruefeRueckgang({ jetzt: 180, zuletzt: 200, freiBis: null, zeitpunkt: JETZT }).blockiert).toBe(false)
  })

  it('haelt einen Einbruch zurueck', () => {
    const befund = pruefeRueckgang({ jetzt: 0, zuletzt: 200, freiBis: null, zeitpunkt: JETZT })
    expect(befund.blockiert).toBe(true)
    expect(befund.meldung).toContain('0 statt zuletzt 200')
  })

  it('laesst ihn nach einer Freigabe durch — und sagt trotzdem, was passiert', () => {
    const befund = pruefeRueckgang({
      jetzt: 0,
      zuletzt: 200,
      freiBis: '2026-09-22T08:00:00Z',
      zeitpunkt: JETZT,
    })
    expect(befund.blockiert).toBe(false)
    expect(befund.freigegeben).toBe(true)
    expect(befund.meldung).toContain('Rückgang')
  })

  it('achtet eine abgelaufene Freigabe nicht mehr', () => {
    const befund = pruefeRueckgang({
      jetzt: 0,
      zuletzt: 200,
      freiBis: '2026-09-21T08:00:00Z',
      zeitpunkt: JETZT,
    })
    expect(befund.blockiert).toBe(true)
  })
})

describe('freigabeBis', () => {
  it('gilt fuer eine Nacht', () => {
    const bis = new Date(freigabeBis(JETZT)).getTime() - JETZT.getTime()
    expect(bis).toBe(FREIGABE_STUNDEN * 3600 * 1000)
  })
})
