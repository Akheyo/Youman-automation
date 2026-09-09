import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AUSLOESER_LABEL, LaufStatusPlakette } from '@/components/Status'
import { LaufSteuerung } from '@/components/Steuerung'
import { Leer } from '@/components/Leer'
import { darfSteuern, nutzerErzwingen } from '@/lib/auth'
import { dauer, datumZeit, nurZeit, zahl } from '@/lib/format'
import { ausfuehrungHolen, logsZuAusfuehrung } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: 'Lauf ' + params.id.slice(0, 8) }
}

export default async function AusfuehrungDetail({ params }: { params: { id: string } }) {
  const nutzer = await nutzerErzwingen()
  const steuern = darfSteuern(nutzer)

  const lauf = await ausfuehrungHolen(params.id)
  if (!lauf) notFound()

  const logs = await logsZuAusfuehrung(lauf.id)
  const hatEinAusgabe = Object.keys(lauf.input ?? {}).length > 0 || Object.keys(lauf.output ?? {}).length > 0

  return (
    <main className="seite">
      <div className="klein schwach">
        <Link href="/executions">Ausführungen</Link> /{' '}
        <Link href={'/automationen/' + lauf.automation_id}>{lauf.automation_name}</Link> / {lauf.id.slice(0, 8)}
      </div>

      <div className="abschnitt-kopf">
        <h1>{lauf.automation_name}</h1>
        <LaufStatusPlakette status={lauf.status} />
        <div className="rechts">
          <LaufSteuerung id={lauf.id} status={lauf.status} darfSteuern={steuern} />
        </div>
      </div>

      {lauf.error_message ? (
        <div className="meldung meldung--fehler">
          <div>
            <strong>Fehlermeldung</strong>
            <div style={{ marginTop: 4 }}>{lauf.error_message}</div>
          </div>
        </div>
      ) : null}

      {lauf.status === 'queued' ? (
        <p className="meldung meldung--info">
          Dieser Lauf steht in der Warteschlange. Ausgefuehrt wird er, sobald die Automation angebunden ist.
        </p>
      ) : null}

      <div className="zwei-spalten">
        <div className="spalte">
          <section className="karte">
            <div className="karte__kopf">
              <h2>Ablauf</h2>
              <span className="rechts klein schwach">{logs.length} Einträge</span>
            </div>
            <div className="karte__koerper">
              {logs.length === 0 ? (
                <Leer titel="Keine Protokollzeilen" text="Für diesen Lauf wurde nichts aufgezeichnet." />
              ) : (
                <div className="zeitstrahl">
                  {logs.map((z, i) => (
                    <div key={z.id} className="zeitstrahl__zeile">
                      <span className="zeitstrahl__zeit">{nurZeit(z.ts)}</span>
                      <span className="zeitstrahl__marke">
                        <span className={'zeitstrahl__punkt zeitstrahl__punkt--' + z.level} />
                        {i < logs.length - 1 ? <span className="zeitstrahl__linie" /> : null}
                      </span>
                      <span className={'zeitstrahl__text' + (z.level === 'error' ? ' zeitstrahl__text--error' : '')}>
                        {z.message}
                        {z.data ? <pre className="code" style={{ marginTop: 6 }}>{JSON.stringify(z.data, null, 2)}</pre> : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {hatEinAusgabe ? (
            <section className="karte">
              <div className="karte__kopf"><h2>Ein- und Ausgabe</h2></div>
              <div className="karte__koerper spalte">
                <div>
                  <h3 className="klein schwach" style={{ marginBottom: 6 }}>Eingabe</h3>
                  <pre className="code">{JSON.stringify(lauf.input ?? {}, null, 2)}</pre>
                </div>
                <div>
                  <h3 className="klein schwach" style={{ marginBottom: 6 }}>Ausgabe</h3>
                  <pre className="code">{JSON.stringify(lauf.output ?? {}, null, 2)}</pre>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="karte">
          <div className="karte__kopf"><h2>Eckdaten</h2></div>
          <div className="karte__koerper">
            <dl className="dl">
              <dt>Lauf-ID</dt>
              <dd className="mono">{lauf.id}</dd>

              <dt>Automation</dt>
              <dd><Link href={'/automationen/' + lauf.automation_id}>{lauf.automation_name}</Link></dd>

              <dt>Auslöser</dt>
              <dd>{AUSLOESER_LABEL[lauf.trigger] ?? lauf.trigger}</dd>

              {lauf.ausgeloest_von ? (
                <>
                  <dt>Ausgelöst von</dt>
                  <dd>{lauf.ausgeloest_von}</dd>
                </>
              ) : null}

              <dt>Start</dt>
              <dd>{datumZeit(lauf.started_at)}</dd>

              <dt>Ende</dt>
              <dd>{datumZeit(lauf.finished_at)}</dd>

              <dt>Dauer</dt>
              <dd>{dauer(lauf.duration_ms)}</dd>

              <dt>Datensätze</dt>
              <dd>{zahl(lauf.items_processed)}</dd>

              {lauf.retry_of ? (
                <>
                  <dt>Wiederholung von</dt>
                  <dd><Link href={'/executions/' + lauf.retry_of} className="mono">{lauf.retry_of.slice(0, 8)}</Link></dd>
                </>
              ) : null}

              {lauf.external_id ? (
                <>
                  <dt>Externe ID</dt>
                  <dd className="mono">{lauf.external_id}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </main>
  )
}
