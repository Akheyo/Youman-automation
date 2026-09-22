/**
 * Konfiguration und Zugang zur Maschinensucher-Strecke.
 *
 * WARUM EIN TOKEN IN DER ADRESSE: Maschinensucher holt die Importdatei nachts
 * selbst ab — von einem Server, dem wir keine Anmeldung beibringen können. Die
 * Adresse IST deshalb das Geheimnis. Sie zeigt unseren markierten Bestand samt
 * Preisen, also gilt sie wie ein Passwort: nicht in Tickets, nicht in Chats.
 * Ein Wechsel des Tokens macht jede alte Adresse sofort wertlos.
 *
 * Ohne gesetztes Token ist die Strecke AUS. Ein offener Feed wäre schlimmer
 * als gar keiner.
 */

import { createHash, timingSafeEqual } from 'node:crypto'
import type { Umgebung } from './inserat'
import type { Umbruchbehandlung } from './csv'

function text(name: string, standard = ''): string {
  const wert = process.env[name]
  return wert == null || wert.trim() === '' ? standard : wert.trim()
}

/**
 * Zahl aus einer Umgebungsvariablen, sonst der Vorgabewert.
 *
 * Die Prüfung auf den leeren Text ist der Punkt: Number('') ist 0 und damit
 * "endlich" — eine nicht gesetzte MASCHINENSUCHER_MWST wäre stillschweigend
 * 0 % geworden, und jeder Preis ginge um den Steuersatz zu hoch raus.
 */
function zahlAus(name: string, standard: number): number {
  const roh = text(name)
  if (!roh) return standard
  const wert = Number(roh.replace(',', '.'))
  return Number.isFinite(wert) ? wert : standard
}

export function feedToken(): string {
  return text('MASCHINENSUCHER_FEED_TOKEN')
}

/** Ist die Strecke eingerichtet? Ohne Token bleibt alles zu. */
export function eingerichtet(): boolean {
  return feedToken().length >= 16
}

/**
 * Vergleicht zwei Token, ohne über die Laufzeit zu verraten, wie weit sie
 * übereinstimmen. Über den Hash, damit unterschiedliche Längen nicht schon an
 * timingSafeEqual scheitern.
 */
export function tokenStimmt(angeboten: string | null | undefined): boolean {
  const echt = feedToken()
  if (echt.length < 16) return false
  if (!angeboten) return false
  const a = createHash('sha256').update(angeboten).digest()
  const b = createHash('sha256').update(echt).digest()
  return timingSafeEqual(a, b)
}

/**
 * Holt das Token aus der Anfrage: aus `?token=`, aus `Authorization: Bearer`
 * oder aus HTTP-Basic. Welche Form die Gegenstelle anbietet, hängt davon ab,
 * wie der automatische Import eingerichtet wird — deshalb alle drei.
 */
export function tokenAusAnfrage(request: Request): string | null {
  const url = new URL(request.url)
  const ausQuery = url.searchParams.get('token')
  if (ausQuery) return ausQuery

  const kopf = request.headers.get('authorization') ?? ''
  if (/^bearer /i.test(kopf)) return kopf.slice(7).trim()
  if (/^basic /i.test(kopf)) {
    try {
      const entschluesselt = Buffer.from(kopf.slice(6).trim(), 'base64').toString('utf8')
      const doppelpunkt = entschluesselt.indexOf(':')
      return doppelpunkt >= 0 ? entschluesselt.slice(doppelpunkt + 1) : entschluesselt
    } catch {
      return null
    }
  }
  return null
}

/** Zuordnung "wort=kategorie,wort=kategorie" aus einer Umgebungsvariablen. */
export function leseZuordnung(roh: string): Array<{ wort: string; kategorie: string }> {
  return roh
    .split(',')
    .map((paar) => paar.split('='))
    .filter((teile) => teile.length === 2 && teile[0].trim() && teile[1].trim())
    .map(([wort, kategorie]) => ({ wort: wort.trim(), kategorie: kategorie.trim() }))
}

/** Alles, was nicht am Artikel hängt, sondern am Betrieb. */
export function umgebung(): Umgebung {
  return {
    nummernPraefix: text('MASCHINENSUCHER_NUMMER_PRAEFIX', 'KK-'),
    preisIst: text('MASCHINENSUCHER_PREIS_IST', 'brutto') === 'netto' ? 'netto' : 'brutto',
    mwst: zahlAus('MASCHINENSUCHER_MWST', 19),
    land: text('MASCHINENSUCHER_LAND', 'DE'),
    plz: text('MASCHINENSUCHER_PLZ'),
    ort: text('MASCHINENSUCHER_ORT'),
    ansprechpartner: text('MASCHINENSUCHER_ANSPRECHPARTNER'),
    telefon: text('MASCHINENSUCHER_TELEFON'),
    email: text('MASCHINENSUCHER_EMAIL'),
    kategorieStandard: text('MASCHINENSUCHER_KATEGORIE'),
    kategorieZuordnung: leseZuordnung(text('MASCHINENSUCHER_KATEGORIEN')),
    shopBasisUrl: text('SHOP_BASIS_URL'),
    veraltetNachTagen: zahlAus('MASCHINENSUCHER_VERALTET_TAGE', 3),
  }
}

export interface Dateiformat {
  trenner: string
  kodierung: 'utf-8' | 'latin1'
  umbrueche: Umbruchbehandlung
  /** Kopfzeile der offiziellen Beispieldatei, falls hinterlegt. */
  kopfzeile: string
}

export function dateiformat(): Dateiformat {
  const trennerRoh = text('MASCHINENSUCHER_TRENNER', ';')
  return {
    // "tab" ausschreiben zu können ist kein Luxus: ein Tabulator in einer
    // Umgebungsvariablen überlebt kein Copy-Paste durch drei Oberflächen.
    trenner: trennerRoh.toLowerCase() === 'tab' ? '\t' : trennerRoh.slice(0, 1) || ';',
    kodierung: text('MASCHINENSUCHER_KODIERUNG', 'utf-8') === 'latin1' ? 'latin1' : 'utf-8',
    umbrueche: text('MASCHINENSUCHER_UMBRUECHE', 'entfernen') === 'behalten' ? 'behalten' : 'entfernen',
    kopfzeile: text('MASCHINENSUCHER_KOPFZEILE'),
  }
}

/** Öffentliche Adresse des Dashboards — für die Abholadresse in der Oberfläche. */
export function basisAdresse(request?: Request): string {
  const gesetzt = text('APP_URL') || text('MASCHINENSUCHER_BASIS_URL')
  if (gesetzt) return gesetzt.replace(/\/+$/, '')
  if (request) {
    const url = new URL(request.url)
    return `${url.protocol}//${url.host}`
  }
  return ''
}

/** Die Adresse, die im Maschinensucher-Konto als automatischer Import steht. */
export function feedAdresse(basis: string): string {
  const token = feedToken()
  return token ? `${basis.replace(/\/+$/, '')}/api/maschinensucher/feed?token=${encodeURIComponent(token)}` : ''
}
