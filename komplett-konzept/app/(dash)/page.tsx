import Link from 'next/link'
import { AutomationStatusPlakette, LaufStatusPlakette, QUELLE_LABEL, SchwerePlakette } from '@/components/Status'
import { AutomationSteuerung } from '@/components/Steuerung'
import { Verlauf } from '@/components/Verlauf'
import { Leer } from '@/components/Leer'
import { darfSteuern, nutzerErzwingen } from '@/lib/auth'
import { dauer, datumZeit, prozent, relativeZeit, zahl } from '@/lib/format'
import {
  ausfuehrungen,
  automationenMitKennzahlen,
  fehlerListe,
  kennzahlen,
  verlauf14Tage,
} from '@/lib/queries'

export const metadata = { title: 'Übersicht' }
export const dynamic = 'force-dynamic'

export default async function UebersichtSeite() {
  const nutzer = await nutzerErzwingen()
  const steuern = darfSteuern(nutzer)

  const [zahlen, automationen, letzteLäufe, offeneFehler, verlauf] = await Promise.all([
    kennzahlen(),
    automationenMitKennzahlen(),
    ausfuehrungen({ zeitraum: '24h', limit: 8 }),
    fehlerListe({ status: 'open', limit: 6 }),
    verlauf14Tage(),
  ])

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Übersicht</h1>
        <span className="schwach klein">Stand: {datumZeit(new Date())}</span>
      </div>

      {automationen.length === 0 ? (
        <p className="meldung meldung--info">
          Es sind noch keine Automationen hinterlegt. Beispieldaten anlegen mit{' '}
          <code className="mono">npm run db:seed</code>.
        </p>
      ) : null}

      {/* --- Kennzahlen --- */}
      <section className="kpi-reihe" aria-label="Kennzahlen">
        <div className="kpi">
          <span className="kpi__label">Automationen aktiv</span>
          <span className="kpi__wert">{zahlen.automationen_aktiv}</span>
          <span className="kpi__zusatz">von {zahlen.automationen_gesamt} insgesamt</span>
        </div>

        <div className="kpi kpi--laeuft">
          <span className="kpi__label">Läuft gerade</span>
          <span className="kpi__wert">{zahlen.laeufe_laufend}</span>
          <span className="kpi__zusatz">{zahl(zahlen.laeufe_24h)} Läufe in 24 Std</span>
        </div>

        <div className={'kpi' + ((zahlen.erfolgsquote_24h ?? 100) < 90 ? ' kpi--warn' : ' kpi--ok')}>
          <span className="kpi__label">Erfolgsquote 24 Std</span>
          <span className="kpi__wert">{prozent(zahlen.erfolgsquote_24h, 1)}</span>
          <span className="kpi__zusatz">{zahl(zahlen.fehlgeschlagen_24h)} fehlgeschlagen</span>
        </div>

        <div className={'kpi' + (zahlen.offene_fehler > 0 ? ' kpi--fehler' : '')}>
          <span className="kpi__label">Offene Fehler</span>
          <span className="kpi__wert">{zahlen.offene_fehler}</span>
          <span className="kpi__zusatz">
            {zahlen.offene_fehler > 0 ? <Link href="/fehler">Ansehen und bearbeiten</Link> : 'Alles sauber'}
          </span>
        </div>

        <div className={'kpi' + (zahlen.automationen_fehler > 0 ? ' kpi--fehler' : '')}>
          <span className="kpi__label">Gestörte Automationen</span>
          <span className="kpi__wert">{zahlen.automationen_fehler}</span>
          <span className="kpi__zusatz">{zahlen.automationen_pausiert} pausiert</span>
        </div>
      </section>

      {/* --- Verlauf --- */}
      <section className="karte">
        <div className="karte__kopf">
          <h2>Läufe der letzten 14 Tage</h2>
          <div className="rechts klein schwach">
            <span className="reihe" style={{ gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--kk-blau-hell)' }} /> erfolgreich
            </span>
            <span className="reihe" style={{ gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--fehler)' }} /> fehlgeschlagen
            </span>
          </div>
        </div>
        <div className="karte__koerper">
          <Verlauf daten={verlauf} />
        </div>
      </section>

      {/* --- Automationen --- */}
      <section className="spalte">
        <div className="abschnitt-kopf">
          <h2>Automationen</h2>
          <div className="rechts">
            <Link href="/automationen" className="btn btn--klein">Alle ansehen</Link>
          </div>
        </div>

        {automationen.length === 0 ? (
          <div className="karte"><Leer titel="Noch keine Automationen" text="Sobald welche angebunden sind, erscheinen sie hier." /></div>
        ) : (
          <div className="kachel-gitter">
            {automationen.slice(0, 6).map((a) => (
              <article
                key={a.id}
                className={
                  'kachel kachel--' +
                  (a.status === 'error' ? 'fehler' : a.status === 'active' ? 'aktiv' : 'pausiert')
                }
              >
                <div className="kachel__kopf">
                  <div className="wachsen">
                    <h3 className="kachel__titel">
                      <Link href={'/automationen/' + a.id}>{a.name}</Link>
                    </h3>
                    <span className="klein schwach">
                      {QUELLE_LABEL[a.source] ?? a.source}
                      {a.schedule_label ? ' · ' + a.schedule_label : ''}
                    </span>
                  </div>
                  <AutomationStatusPlakette status={a.status} />
                </div>

                <p className="kachel__beschreibung">{a.description ?? 'Keine Beschreibung hinterlegt.'}</p>

                <div className="kachel__zahlen">
                  <div className="kachel__zahl">
                    <b>{zahl(a.laeufe_24h)}</b>
                    <span>Läufe 24 Std</span>
                  </div>
                  <div className="kachel__zahl">
                    <b style={{ color: (a.erfolgsquote ?? 100) < 90 ? 'var(--warn)' : undefined }}>
                      {prozent(a.erfolgsquote, 0)}
                    </b>
                    <span>Erfolg</span>
                  </div>
                  <div className="kachel__zahl">
                    <b style={{ color: a.offene_fehler > 0 ? 'var(--fehler)' : undefined }}>{a.offene_fehler}</b>
                    <span>offene Fehler</span>
                  </div>
                </div>

                <div className="kachel__fuss">
                  Zuletzt {relativeZeit(a.last_run_at)}
                  {a.letzte_dauer_ms !== null ? ' · ' + dauer(a.letzte_dauer_ms) : ''}
                </div>

                <AutomationSteuerung id={a.id} status={a.status} darfSteuern={steuern} klein />
              </article>
            ))}
          </div>
        )}
      </section>

      {/* --- Letzte Läufe + offene Fehler --- */}
      <div className="zwei-spalten">
        <section className="karte">
          <div className="karte__kopf">
            <h2>Letzte Ausführungen</h2>
            <div className="rechts">
              <Link href="/executions" className="btn btn--klein">Alle</Link>
            </div>
          </div>
          {letzteLäufe.zeilen.length === 0 ? (
            <Leer titel="Keine Läufe in den letzten 24 Stunden" />
          ) : (
            <div className="tabelle-huelle">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th>Automation</th>
                    <th>Status</th>
                    <th>Start</th>
                    <th style={{ textAlign: 'right' }}>Dauer</th>
                  </tr>
                </thead>
                <tbody>
                  {letzteLäufe.zeilen.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={'/executions/' + e.id} className="zeilen-link">{e.automation_name}</Link>
                      </td>
                      <td><LaufStatusPlakette status={e.status} /></td>
                      <td className="schwach">{relativeZeit(e.started_at)}</td>
                      <td className="zahl schwach">{dauer(e.duration_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="karte">
          <div className="karte__kopf">
            <h2>Offene Fehler</h2>
            <div className="rechts">
              <Link href="/fehler" className="btn btn--klein">Alle</Link>
            </div>
          </div>
          {offeneFehler.zeilen.length === 0 ? (
            <Leer titel="Keine offenen Fehler" text="Sieht gut aus." />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {offeneFehler.zeilen.map((f) => (
                <li key={f.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--rand)' }}>
                  <div className="reihe" style={{ gap: 8, marginBottom: 4 }}>
                    <SchwerePlakette severity={f.severity} />
                    <span className="klein schwach">{f.automation_name ?? 'Ohne Zuordnung'}</span>
                    <span className="klein schwach" style={{ marginLeft: 'auto' }}>{relativeZeit(f.occurred_at)}</span>
                  </div>
                  <Link href={'/fehler?id=' + f.id} className="klein zeilen-link">{f.message}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
