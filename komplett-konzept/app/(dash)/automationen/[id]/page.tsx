import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AutomationStatusPlakette, AUSLOESER_LABEL, LaufStatusPlakette, QUELLE_LABEL } from '@/components/Status'
import { AlleFehlerErledigen, AutomationSteuerung } from '@/components/Steuerung'
import { Verlauf } from '@/components/Verlauf'
import { Leer } from '@/components/Leer'
import { darfSteuern, nutzerErzwingen } from '@/lib/auth'
import { dauer, datumZeit, prozent, relativeZeit, zahl } from '@/lib/format'
import {
  ausfuehrungen,
  automationHolen,
  automationenMitKennzahlen,
  fehlerListe,
  verlauf14Tage,
} from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const a = await automationHolen(params.id)
  return { title: a?.name ?? 'Automation' }
}

export default async function AutomationDetail({ params }: { params: { id: string } }) {
  const nutzer = await nutzerErzwingen()
  const steuern = darfSteuern(nutzer)

  const automation = await automationHolen(params.id)
  if (!automation) notFound()

  const [alle, laeufe, fehler, verlauf] = await Promise.all([
    automationenMitKennzahlen(),
    ausfuehrungen({ automationId: automation.id, zeitraum: 'alle', limit: 25 }),
    fehlerListe({ automationId: automation.id, limit: 20 }),
    verlauf14Tage(automation.id),
  ])

  const kennzahl = alle.find((a) => a.id === automation.id)
  const offeneFehler = fehler.zeilen.filter((f) => f.status !== 'resolved').length

  return (
    <main className="seite">
      <div className="klein schwach">
        <Link href="/automationen">Automationen</Link> / {automation.name}
      </div>

      <div className="abschnitt-kopf">
        <h1>{automation.name}</h1>
        <AutomationStatusPlakette status={automation.status} />
        <div className="rechts">
          <AutomationSteuerung id={automation.id} status={automation.status} darfSteuern={steuern} />
        </div>
      </div>

      <p className="gedaempft" style={{ maxWidth: '70ch' }}>
        {automation.description ?? 'Keine Beschreibung hinterlegt.'}
      </p>

      <section className="kpi-reihe">
        <div className="kpi">
          <span className="kpi__label">Laeufe (24 Std)</span>
          <span className="kpi__wert">{zahl(kennzahl?.laeufe_24h ?? 0)}</span>
        </div>
        <div className={'kpi' + ((kennzahl?.erfolgsquote ?? 100) < 90 ? ' kpi--warn' : ' kpi--ok')}>
          <span className="kpi__label">Erfolgsquote (24 Std)</span>
          <span className="kpi__wert">{prozent(kennzahl?.erfolgsquote ?? null, 1)}</span>
        </div>
        <div className={'kpi' + (offeneFehler > 0 ? ' kpi--fehler' : '')}>
          <span className="kpi__label">Offene Fehler</span>
          <span className="kpi__wert">{offeneFehler}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Letzte Dauer</span>
          <span className="kpi__wert" style={{ fontSize: 22 }}>{dauer(kennzahl?.letzte_dauer_ms ?? null)}</span>
        </div>
      </section>

      <div className="zwei-spalten">
        <div className="spalte">
          <section className="karte">
            <div className="karte__kopf"><h2>Laeufe der letzten 14 Tage</h2></div>
            <div className="karte__koerper"><Verlauf daten={verlauf} /></div>
          </section>

          <section className="karte">
            <div className="karte__kopf">
              <h2>Ausführungen</h2>
              <div className="rechts">
                <Link href={'/executions?automation=' + automation.id} className="btn btn--klein">Alle ansehen</Link>
              </div>
            </div>
            {laeufe.zeilen.length === 0 ? (
              <Leer titel="Noch keine Ausführungen" />
            ) : (
              <div className="tabelle-huelle">
                <table className="tabelle">
                  <thead>
                    <tr>
                      <th>Start</th>
                      <th>Status</th>
                      <th>Auslöser</th>
                      <th style={{ textAlign: 'right' }}>Dauer</th>
                      <th style={{ textAlign: 'right' }}>Datensätze</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {laeufe.zeilen.map((e) => (
                      <tr key={e.id}>
                        <td className="klein">{datumZeit(e.started_at)}</td>
                        <td><LaufStatusPlakette status={e.status} /></td>
                        <td className="klein schwach">{AUSLOESER_LABEL[e.trigger] ?? e.trigger}</td>
                        <td className="zahl schwach">{dauer(e.duration_ms)}</td>
                        <td className="zahl schwach">{zahl(e.items_processed)}</td>
                        <td><Link href={'/executions/' + e.id} className="klein">Details</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="karte">
            <div className="karte__kopf">
              <h2>Fehler</h2>
              {offeneFehler > 0 ? (
                <div className="rechts">
                  <AlleFehlerErledigen automationId={automation.id} darfSteuern={steuern} />
                </div>
              ) : null}
            </div>
            {fehler.zeilen.length === 0 ? (
              <Leer titel="Keine Fehler aufgezeichnet" />
            ) : (
              <div className="tabelle-huelle">
                <table className="tabelle">
                  <thead>
                    <tr>
                      <th>Zeitpunkt</th>
                      <th>Code</th>
                      <th>Meldung</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fehler.zeilen.map((f) => (
                      <tr key={f.id}>
                        <td className="klein schwach">{relativeZeit(f.occurred_at)}</td>
                        <td className="mono">{f.code ?? '—'}</td>
                        <td className="klein">
                          <Link href={'/fehler?id=' + f.id} className="zeilen-link">{f.message}</Link>
                        </td>
                        <td className="klein">{f.status === 'resolved' ? 'erledigt' : f.status === 'acknowledged' ? 'in Arbeit' : 'offen'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="karte">
          <div className="karte__kopf"><h2>Eckdaten</h2></div>
          <div className="karte__koerper">
            <dl className="dl">
              <dt>Kennung</dt>
              <dd className="mono">{automation.key}</dd>

              <dt>Quelle</dt>
              <dd>{QUELLE_LABEL[automation.source] ?? automation.source}</dd>

              <dt>Kategorie</dt>
              <dd>{automation.category ?? '—'}</dd>

              <dt>Zeitplan</dt>
              <dd>
                {automation.schedule_label ?? '—'}
                {automation.schedule_cron ? <div className="mono schwach klein">{automation.schedule_cron}</div> : null}
              </dd>

              <dt>Nächster Lauf</dt>
              <dd>{automation.next_run_at ? relativeZeit(automation.next_run_at) : '—'}</dd>

              <dt>Letzter Lauf</dt>
              <dd>{datumZeit(automation.last_run_at)}</dd>

              <dt>Verantwortlich</dt>
              <dd>{automation.owner ?? '—'}</dd>

              <dt>Angelegt</dt>
              <dd>{datumZeit(automation.created_at)}</dd>
            </dl>

            {Object.keys(automation.config ?? {}).length > 0 ? (
              <>
                <hr className="trennen" style={{ margin: '16px 0' }} />
                <h3 className="klein" style={{ marginBottom: 8 }}>Konfiguration</h3>
                <pre className="code">{JSON.stringify(automation.config, null, 2)}</pre>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
