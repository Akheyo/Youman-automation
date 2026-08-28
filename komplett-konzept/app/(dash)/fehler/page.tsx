import Link from 'next/link'
import { FehlerStatusPlakette, SchwerePlakette } from '@/components/Status'
import { FehlerSteuerung } from '@/components/Steuerung'
import { Leer } from '@/components/Leer'
import { darfSteuern, nutzerErzwingen } from '@/lib/auth'
import { datumZeit, relativeZeit, zahl } from '@/lib/format'
import { automationenMitKennzahlen, fehlerListe } from '@/lib/queries'

export const metadata = { title: 'Fehler' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONEN = [
  ['open', 'Offen'],
  ['acknowledged', 'In Arbeit'],
  ['resolved', 'Erledigt'],
  ['alle', 'Alle'],
] as const

const SCHWERE_OPTIONEN = [
  ['alle', 'Alle Schweregrade'],
  ['critical', 'Kritisch'],
  ['error', 'Fehler'],
  ['warning', 'Warnung'],
] as const

export default async function FehlerSeite({
  searchParams,
}: {
  searchParams: { status?: string; severity?: string; automation?: string; id?: string }
}) {
  const nutzer = await nutzerErzwingen()
  const steuern = darfSteuern(nutzer)
  const status = searchParams.status ?? 'open'

  const [automationen, ergebnis] = await Promise.all([
    automationenMitKennzahlen(),
    fehlerListe({
      status: searchParams.id ? 'alle' : status,
      severity: searchParams.severity,
      automationId: searchParams.automation || undefined,
      limit: 100,
    }),
  ])

  const zeilen = searchParams.id
    ? ergebnis.zeilen.filter((f) => f.id === searchParams.id)
    : ergebnis.zeilen

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Fehler</h1>
        <span className="schwach klein">{zahl(zeilen.length)} angezeigt</span>
      </div>

      {searchParams.id ? (
        <p className="meldung meldung--info">
          Einzelner Fehler wird angezeigt. <Link href="/fehler">Zurück zur Liste</Link>
        </p>
      ) : (
        <form className="filter-leiste karte" style={{ padding: 12 }} method="get">
          <div className="feld">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              {STATUS_OPTIONEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
            </select>
          </div>
          <div className="feld">
            <label htmlFor="severity">Schwere</label>
            <select id="severity" name="severity" defaultValue={searchParams.severity ?? 'alle'}>
              {SCHWERE_OPTIONEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
            </select>
          </div>
          <div className="feld">
            <label htmlFor="automation">Automation</label>
            <select id="automation" name="automation" defaultValue={searchParams.automation ?? ''}>
              <option value="">Alle</option>
              {automationen.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn--klein btn--primaer">Filtern</button>
          <Link href="/fehler" className="btn btn--klein">Zurücksetzen</Link>
        </form>
      )}

      {zeilen.length === 0 ? (
        <section className="karte">
          <Leer
            titel={status === 'open' ? 'Keine offenen Fehler' : 'Nichts gefunden'}
            text={status === 'open' ? 'Alle Automationen laufen sauber.' : 'Andere Filter versuchen.'}
          />
        </section>
      ) : (
        <div className="spalte">
          {zeilen.map((f) => (
            <article key={f.id} className="karte">
              <div className="karte__kopf">
                <SchwerePlakette severity={f.severity} />
                <FehlerStatusPlakette status={f.status} />
                <span className="klein schwach">
                  {f.automation_name ? (
                    <Link href={'/automationen/' + f.automation_id}>{f.automation_name}</Link>
                  ) : (
                    'Ohne Zuordnung'
                  )}
                </span>
                <div className="rechts">
                  <span className="klein schwach" title={datumZeit(f.occurred_at)}>{relativeZeit(f.occurred_at)}</span>
                  <FehlerSteuerung id={f.id} status={f.status} darfSteuern={steuern} />
                </div>
              </div>

              <div className="karte__koerper spalte">
                <div className="reihe" style={{ alignItems: 'flex-start', gap: 12 }}>
                  {f.code ? <code className="mono" style={{ color: 'var(--kk-gelb)' }}>{f.code}</code> : null}
                  <p style={{ fontWeight: 550 }}>{f.message}</p>
                </div>

                {f.stack ? <pre className="code">{f.stack}</pre> : null}

                <div className="reihe klein schwach" style={{ flexWrap: 'wrap', gap: 16 }}>
                  <span>Aufgetreten: {datumZeit(f.occurred_at)}</span>
                  {f.execution_id ? (
                    <Link href={'/executions/' + f.execution_id}>Zum Lauf</Link>
                  ) : null}
                  {f.bearbeitet_von ? <span>Bearbeitet von: {f.bearbeitet_von}</span> : null}
                  {f.resolved_at ? <span>Erledigt: {datumZeit(f.resolved_at)}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
