import Link from 'next/link'
import { Leer } from '@/components/Leer'
import { darfSteuern, nutzerErzwingen } from '@/lib/auth'
import { datumZeit, relativeZeit, zahl } from '@/lib/format'
import { artikelZaehlen, kandidaten, markierteArtikel, teileAuf, type ArtikelZeile } from '@/lib/maschinensucher/artikel'
import { baueInserat, type Inserat } from '@/lib/maschinensucher/inserat'
import { freigabeStand, letzteAbholungMenge, letzteLaeufe } from '@/lib/maschinensucher/lauf'
import { spaltenPlan } from '@/lib/maschinensucher/felder'
import { pruefeRueckgang } from '@/lib/maschinensucher/rueckgang'
import { basisAdresse, dateiformat, eingerichtet, feedAdresse, umgebung } from '@/lib/maschinensucher/zugang'
import { plentyEingerichtet } from '@/lib/plenty/client'
import { AbgleichKnopf, AdressFeld, FreigabeKnopf, KategorieFeld, MarkierKnopf } from './Knoepfe'

export const metadata = { title: 'Maschinensucher' }
export const dynamic = 'force-dynamic'

/**
 * Die Maschinensucher-Seite: markieren, prüfen, nachsehen.
 *
 * Drei Fragen beantwortet sie, in dieser Reihenfolge, weil sie so gestellt
 * werden:
 *
 *   1. Läuft die Strecke? (Adresse, letzte Abholung, letzter Abgleich)
 *   2. Was steht draußen — und was hängt woran?
 *   3. Was könnte noch hoch?
 *
 * Sie ist die einzige Kontrolle über eine Datei, die sonst nur eine Maschine
 * liest. Deshalb zeigt sie nicht bloß die Liste, sondern auch, was fehlt.
 */
export default async function MaschinensucherSeite({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const nutzer = await nutzerErzwingen()
  const steuern = darfSteuern(nutzer)

  const umg = umgebung()
  const format = dateiformat()
  const plan = spaltenPlan(format.kopfzeile, format.trenner)

  const [markierteZeilen, offeneZeilen, zaehler, abholungen, syncLaeufe, zuletztMenge, freiBis] = await Promise.all([
    markierteArtikel(),
    kandidaten(searchParams.q ?? '', 40),
    artikelZaehlen(),
    letzteLaeufe('maschinensucher-abholung', 5),
    letzteLaeufe('maschinensucher-sync', 1),
    letzteAbholungMenge(),
    freigabeStand(),
  ])

  const { bereit, zurueck } = teileAuf(markierteZeilen, umg)
  const rueckgang = pruefeRueckgang({
    jetzt: bereit.length,
    zuletzt: zuletztMenge,
    freiBis,
    zeitpunkt: new Date(),
  })

  // Was an der Einrichtung fehlt — einmal zentral, statt an jeder Zeile.
  const einrichtung: string[] = []
  if (!eingerichtet()) einrichtung.push('MASCHINENSUCHER_FEED_TOKEN fehlt (mindestens 16 Zeichen) — die Datei wird nicht ausgeliefert.')
  if (!plentyEingerichtet()) einrichtung.push('PlentyONE ist nicht eingerichtet — ohne Abgleich bleibt die Artikeldatenbank leer.')
  if (!umg.kategorieStandard) einrichtung.push('MASCHINENSUCHER_KATEGORIE fehlt — ohne Kategorie geht kein Inserat raus.')
  if (!umg.plz || !umg.ort) einrichtung.push('MASCHINENSUCHER_PLZ / MASCHINENSUCHER_ORT fehlen — der Standort ist Pflicht.')
  if (!umg.email) einrichtung.push('MASCHINENSUCHER_EMAIL fehlt — Anfragen hätten keinen Empfänger.')
  if (plan.herkunft === 'standard') {
    einrichtung.push(
      'MASCHINENSUCHER_KOPFZEILE ist nicht hinterlegt: Die Datei geht in unserer Standardreihenfolge raus. ' +
        'Verbindlich ist die Beispieldatei aus dem Maschinensucher-Konto — deren Kopfzeile hier eintragen.',
    )
  }
  if (plan.fehlendePflicht.length > 0) {
    einrichtung.push(`Die hinterlegte Kopfzeile hat keine Spalte für: ${plan.fehlendePflicht.join(', ')}.`)
  }

  const adresse = eingerichtet() ? feedAdresse(basisAdresse()) : ''
  const letzterSync = syncLaeufe[0]

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Maschinensucher</h1>
        <span className="schwach klein">
          Markierte Artikel aus der Artikeldatenbank — abgeholt, nicht hochgeladen
        </span>
      </div>

      {rueckgang.blockiert ? (
        <div className="meldung meldung--fehler">
          <strong>Die Datei wird zurückgehalten.</strong> {rueckgang.meldung}
          <div style={{ marginTop: 'var(--s-3)' }}>
            <FreigabeKnopf darfSteuern={steuern} />
          </div>
        </div>
      ) : null}

      {!rueckgang.blockiert && rueckgang.freigegeben && rueckgang.meldung ? (
        <p className="meldung meldung--hinweis">Rückgang ist freigegeben: {rueckgang.meldung}</p>
      ) : null}

      {einrichtung.length > 0 ? (
        <div className="meldung meldung--hinweis">
          <strong>An der Einrichtung fehlt noch etwas:</strong>
          <ul style={{ margin: 'var(--s-2) 0 0 1.1rem' }}>
            {einrichtung.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- 1. Läuft die Strecke? ---- */}
      <div className="kpi-reihe">
        <div className="kpi kpi--ok">
          <span className="kpi__label">In der Datei</span>
          <span className="kpi__wert">{zahl(bereit.length)}</span>
          <span className="kpi__zusatz">{zaehler.draussen} schon abgeholt</span>
        </div>
        <div className={`kpi ${zurueck.length > 0 ? 'kpi--warn' : ''}`}>
          <span className="kpi__label">Markiert, unvollständig</span>
          <span className="kpi__wert">{zahl(zurueck.length)}</span>
          <span className="kpi__zusatz">gehen nicht raus</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Artikel im Stamm</span>
          <span className="kpi__wert">{zahl(zaehler.gesamt)}</span>
          <span className="kpi__zusatz">
            {letzterSync ? `Abgleich ${relativeZeit(letzterSync.started_at)}` : 'noch nie abgeglichen'}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Preis</span>
          <span className="kpi__wert">{umg.mwst} %</span>
          <span className="kpi__zusatz">
            {umg.preisIst === 'netto' ? 'Plenty führt netto' : 'Plenty führt brutto → netto gerechnet'}
          </span>
        </div>
      </div>

      <section className="karte">
        <div className="karte__kopf">
          <h2>Abholadresse</h2>
          <span className="schwach klein">
            Im Maschinensucher-Konto unter „Datenimport → Automatischer Import&ldquo; eintragen
          </span>
          <div className="rechts">
            <AbgleichKnopf darfSteuern={steuern} />
            <AbgleichKnopf darfSteuern={steuern} vonVorn />
          </div>
        </div>
        <div className="karte__koerper">
          {adresse ? (
            <>
              <AdressFeld adresse={adresse} />
              <p className="klein" style={{ color: 'var(--warn)', marginTop: 'var(--s-3)' }}>
                Diese Adresse ist ein Passwort: Wer sie hat, sieht unseren markierten Bestand samt Preisen. Nicht in
                Tickets, nicht in Chats.
              </p>
            </>
          ) : (
            <Leer titel="Noch keine Adresse" text="Es fehlt das Feed-Token (siehe oben)." />
          )}

          <p className="klein schwach" style={{ marginTop: 'var(--s-4)' }}>
            Datei: {plan.spalten.length} Spalten ({plan.herkunft === 'beispieldatei' ? 'aus der Beispieldatei' : 'Standardreihenfolge'}),
            Trennzeichen {format.trenner === '\t' ? 'Tabulator' : format.trenner}, {format.kodierung}, Umbrüche{' '}
            {format.umbrueche}.
          </p>

          <h3 className="klein" style={{ marginTop: 'var(--s-5)' }}>Zuletzt abgeholt</h3>
          {abholungen.length === 0 ? (
            <p className="klein schwach">
              Noch kein Abruf verzeichnet. Solange hier nichts steht, hat Maschinensucher die Datei nie geholt — dann
              stimmt die hinterlegte Adresse nicht oder der automatische Import ist nicht eingeschaltet.
            </p>
          ) : (
            <ul className="klein" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>
              {abholungen.map((a) => (
                <li key={a.id} style={{ color: a.status === 'success' ? 'var(--text-gedaempft)' : 'var(--fehler)' }}>
                  {datumZeit(a.started_at)} ·{' '}
                  {a.status === 'success'
                    ? `${a.items_processed} Inserate${
                        Number(a.output?.uebersprungen ?? 0) > 0 ? `, ${a.output?.uebersprungen} übersprungen` : ''
                      }`
                    : (a.error_message ?? 'abgewiesen')}{' '}
                  · <Link href={`/executions/${a.id}`}>Lauf ansehen</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---- 2. Was steht draußen? ---- */}
      <section className="karte">
        <div className="karte__kopf">
          <h2>Markiert für Maschinensucher</h2>
          <span className="schwach klein">{zahl(markierteZeilen.length)} Artikel</span>
        </div>
        <div className="karte__koerper">
          {markierteZeilen.length === 0 ? (
            <Leer titel="Noch nichts markiert" text="Unten einen Artikel suchen und auf den Marktplatz stellen." />
          ) : (
            <Liste eintraege={[...zurueck, ...bereit]} darfSteuern={steuern} />
          )}
        </div>
      </section>

      {/* ---- 3. Was könnte noch hoch? ---- */}
      <section className="karte">
        <div className="karte__kopf">
          <h2>Aus der Artikeldatenbank</h2>
          <form method="get" className="rechts">
            <input
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ''}
              placeholder="Titel, Hersteller, Nummer, EAN"
              aria-label="Artikel suchen"
              style={{ minHeight: 34, minWidth: '16rem' }}
            />
            <button type="submit" className="btn btn--klein">Suchen</button>
          </form>
        </div>
        <div className="karte__koerper">
          {offeneZeilen.length === 0 ? (
            <Leer
              titel={searchParams.q ? 'Nichts gefunden' : 'Keine Artikel'}
              text={
                searchParams.q
                  ? 'Anderen Begriff versuchen — gesucht wird in Titel, Hersteller, Modell, Nummer und EAN.'
                  : 'Die Artikeldatenbank ist leer. Der Plenty-Abgleich füllt sie.'
              }
            />
          ) : (
            <Liste
              eintraege={offeneZeilen.map((zeile) => ({ zeile, inserat: baueInserat(zeile, umg) }))}
              darfSteuern={steuern}
            />
          )}
        </div>
      </section>
    </main>
  )
}

/** Eine Artikelliste — links, was drinsteht, rechts die Tat. */
function Liste({
  eintraege,
  darfSteuern,
}: {
  eintraege: Array<{ zeile: ArtikelZeile; inserat: Inserat }>
  darfSteuern: boolean
}) {
  return (
    <div className="tabelle-huelle">
      <table className="tabelle">
        <thead>
          <tr>
            <th>Artikel</th>
            <th>Preis netto</th>
            <th>Rubrik</th>
            <th>Stand</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {eintraege.map(({ zeile, inserat }) => {
            const fehlt = inserat.maengel.length > 0
            const marke = fehlt
              ? { ton: 'warn', text: 'unvollständig' }
              : zeile.ms_abgeholt_am
                ? { ton: 'ok', text: 'auf Maschinensucher' }
                : zeile.ms_markiert
                  ? { ton: 'laeuft', text: 'wartet auf Abholung' }
                  : { ton: 'neutral', text: 'bereit' }

            return (
              <tr key={zeile.id}>
                <td>
                  <div className="zeilen-link">{inserat.werte.titel || 'Ohne Titel'}</div>
                  <div className="klein schwach">
                    {zeile.nummer ?? zeile.plenty_variation_id}
                    {zeile.hersteller ? ` · ${zeile.hersteller}` : ''}
                    {` · ${(zeile.bilder ?? []).length} Fotos`}
                    {zeile.bestand != null ? ` · Bestand ${zeile.bestand}` : ''}
                  </div>
                  {fehlt ? (
                    <ul className="klein" style={{ color: 'var(--warn)', margin: '4px 0 0 1rem' }}>
                      {inserat.maengel.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  ) : null}
                  {inserat.hinweise.length > 0 ? (
                    <ul className="klein schwach" style={{ margin: '4px 0 0 1rem' }}>
                      {inserat.hinweise.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{inserat.werte.preis ? `${inserat.werte.preis} €` : '—'}</td>
                <td>
                  <KategorieFeld id={zeile.id} wert={zeile.kategorie ?? ''} darfSteuern={darfSteuern} />
                </td>
                <td>
                  <span className={`status status--${marke.ton}`}>
                    <span className="status__punkt" />
                    {marke.text}
                  </span>
                  {zeile.ms_markiert_von ? (
                    <div className="klein schwach">von {zeile.ms_markiert_von}</div>
                  ) : null}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <MarkierKnopf
                    id={zeile.id}
                    markiert={zeile.ms_markiert}
                    draussen={Boolean(zeile.ms_abgeholt_am)}
                    darfSteuern={darfSteuern}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
