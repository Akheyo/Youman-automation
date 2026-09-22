import { NextResponse } from 'next/server'
import { baueCsv, kodiere } from '@/lib/maschinensucher/csv'
import { spaltenPlan } from '@/lib/maschinensucher/felder'
import { markierteArtikel, standNachAbholung, teileAuf } from '@/lib/maschinensucher/artikel'
import { freigabeStand, laufMelden, letzteAbholungMenge } from '@/lib/maschinensucher/lauf'
import { pruefeRueckgang } from '@/lib/maschinensucher/rueckgang'
import { dateiformat, eingerichtet, tokenAusAnfrage, tokenStimmt, umgebung } from '@/lib/maschinensucher/zugang'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET → Die Importdatei, die Maschinensucher bei uns abholt.
 *
 * DAS IST DIE AUTOMATION. Im Maschinensucher-Konto wird unter
 * „Datenimport → Automatischer Import" die Adresse dieses Endpunkts
 * hinterlegt; von da an zieht Maschinensucher die Datei jede Nacht ab und
 * gleicht die Inserate damit ab. Was hier drinsteht, steht online — was hier
 * fehlt, verschwindet dort.
 *
 * GELESEN WIRD NUR DIE TABELLE "artikel". PlentyONE wird dabei NICHT
 * angefasst: Ist Plenty nachts in Wartung oder langsam, geht trotzdem
 * heraus, was zuletzt bekannt war. Für den Nachschub sorgt der Abgleich,
 * und der läuft zu seiner eigenen Zeit.
 *
 * Daraus folgt die wichtigste Regel dieser Datei: NIEMALS EINE HALBE LISTE.
 * Geht etwas schief, kommt ein Fehler (HTTP 500) und KEINE kürzere Datei.
 * Eine gültige Datei mit fehlenden Zeilen heißt für die Gegenstelle „diese
 * Artikel gibt es nicht mehr" — und nimmt den halben Bestand vom Markt.
 *
 * Kein Login: Maschinensucher kann sich nirgends anmelden. Der Zugang hängt
 * am Token in der Adresse (siehe zugang.ts).
 */
export async function GET(request: Request) {
  const beginn = new Date()
  const kennung = request.headers.get('user-agent')?.slice(0, 200) ?? null
  const absender = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const herkunft = { absender, kennung }

  if (!eingerichtet()) {
    return new NextResponse('Maschinensucher ist nicht eingerichtet (MASCHINENSUCHER_FEED_TOKEN fehlt).', {
      status: 503,
    })
  }

  if (!tokenStimmt(tokenAusAnfrage(request))) {
    // Bewusst als Lauf protokolliert: Ein falsches Token in der hinterlegten
    // Adresse ist der wahrscheinlichste Fehler dieser Strecke, und ohne
    // diesen Eintrag sieht er von innen aus wie „Maschinensucher holt nicht ab".
    await laufMelden({
      key: 'maschinensucher-abholung',
      status: 'failed',
      startedAt: beginn,
      input: herkunft,
      fehler: { message: 'Abruf mit falschem Token abgewiesen.', code: 'TOKEN', severity: 'warning' },
    })
    return new NextResponse('Zugang verweigert.', { status: 401 })
  }

  const format = dateiformat()
  const plan = spaltenPlan(format.kopfzeile, format.trenner)
  if (plan.fehlendePflicht.length > 0) {
    // Lieber gar keine Datei als eine, in der der Preis in keiner Spalte steht.
    const meldung = `Die hinterlegte Kopfzeile hat keine Spalte für: ${plan.fehlendePflicht.join(', ')}.`
    await laufMelden({
      key: 'maschinensucher-abholung',
      status: 'failed',
      startedAt: beginn,
      input: herkunft,
      fehler: { message: meldung, code: 'SPALTEN' },
    })
    return new NextResponse(meldung, { status: 500 })
  }

  let zeilen
  try {
    zeilen = await markierteArtikel()
  } catch (e) {
    const meldung = `Artikel nicht lesbar: ${e instanceof Error ? e.message : String(e)}`
    await laufMelden({
      key: 'maschinensucher-abholung',
      status: 'failed',
      startedAt: beginn,
      input: herkunft,
      fehler: { message: meldung, code: 'DB', severity: 'critical' },
    })
    return new NextResponse(meldung, { status: 500 })
  }

  const { bereit, zurueck } = teileAuf(zeilen, umgebung())

  // ---- Notbremse ---------------------------------------------------------
  // Ein plötzlich viel kürzerer Feed nimmt den Bestand vom Markt. Lieber ein
  // fehlgeschlagener Import (die Inserate bleiben stehen) als ein
  // erfolgreicher, der leer war. Siehe rueckgang.ts.
  const befund = pruefeRueckgang({
    jetzt: bereit.length,
    zuletzt: await letzteAbholungMenge(),
    freiBis: await freigabeStand(),
    zeitpunkt: new Date(),
  })
  if (befund.blockiert) {
    const meldung = befund.meldung ?? 'Rückgang zurückgehalten.'
    await laufMelden({
      key: 'maschinensucher-abholung',
      status: 'failed',
      startedAt: beginn,
      input: herkunft,
      output: { inserate: bereit.length, uebersprungen: zurueck.length },
      fehler: { message: meldung, code: 'RUECKGANG', severity: 'critical' },
    })
    return new NextResponse(meldung, { status: 500 })
  }

  const text = baueCsv(
    bereit.map((b) => b.inserat.werte),
    plan,
    { trenner: format.trenner, umbrueche: format.umbrueche },
  )
  const koerper = kodiere(text, format.kodierung)

  // ---- Stand an den Artikeln nachführen ---------------------------------
  // Erst jetzt, mit der fertigen Datei in der Hand: Der Zeitstempel bedeutet
  // „war in der abgeholten Datei", nicht „wurde einmal betrachtet".
  try {
    await standNachAbholung(
      bereit.map((b) => ({ id: b.zeile.id, werte: b.inserat.werte as Record<string, string> })),
      zurueck.map((z) => ({ id: z.zeile.id, grund: z.inserat.maengel.join(' ') })),
    )
  } catch {
    // Die Datei ist fertig und korrekt. Dass der Stand nicht mitgeschrieben
    // werden konnte, darf sie nicht aufhalten.
  }

  await laufMelden({
    key: 'maschinensucher-abholung',
    status: 'success',
    startedAt: beginn,
    itemsProcessed: bereit.length,
    input: herkunft,
    output: {
      inserate: bereit.length,
      uebersprungen: zurueck.length,
      bytes: koerper.byteLength,
      spalten: plan.spalten.length,
      kopfzeile: plan.herkunft,
    },
    logs: [
      { level: 'info', message: `${bereit.length} Inserate ausgeliefert (${Math.round(koerper.byteLength / 1024)} KB).` },
      ...(zurueck.length > 0
        ? [
            {
              level: 'warn' as const,
              message:
                `${zurueck.length} markierte Artikel übersprungen: ` +
                zurueck
                  .slice(0, 10)
                  .map((z) => `${z.zeile.nummer ?? z.zeile.plenty_variation_id} (${z.inserat.maengel[0]})`)
                  .join('; '),
            },
          ]
        : []),
      ...(befund.meldung ? [{ level: 'warn' as const, message: `Freigegebener Rückgang: ${befund.meldung}` }] : []),
    ],
  })

  const dateiname = `maschinensucher-${beginn.toISOString().slice(0, 10)}.csv`
  // Als Uint8Array: Ein Node-Buffer ist zwar einer, aber die Typen der
  // Web-Response kennen ihn nicht.
  return new NextResponse(new Uint8Array(koerper), {
    status: 200,
    headers: {
      'Content-Type': `text/csv; charset=${format.kodierung === 'latin1' ? 'ISO-8859-1' : 'utf-8'}`,
      'Content-Disposition': `attachment; filename="${dateiname}"`,
      'Content-Length': String(koerper.byteLength),
      // Eine zwischengespeicherte Preisliste wäre schlimmer als eine langsame.
      'Cache-Control': 'no-store, max-age=0',
      'X-Inserate': String(bereit.length),
      'X-Uebersprungen': String(zurueck.length),
    },
  })
}
