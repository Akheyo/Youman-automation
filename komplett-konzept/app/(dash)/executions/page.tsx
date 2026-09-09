import Link from 'next/link'
import { AUSLOESER_LABEL, LaufStatusPlakette } from '@/components/Status'
import { Leer } from '@/components/Leer'
import { nutzerErzwingen } from '@/lib/auth'
import { dauer, datumZeit, zahl } from '@/lib/format'
import { ausfuehrungen, automationenMitKennzahlen } from '@/lib/queries'

export const metadata = { title: 'Ausführungen' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONEN = [
  ['alle', 'Alle Status'],
  ['success', 'Erfolgreich'],
  ['failed', 'Fehlgeschlagen'],
  ['running', 'Läuft'],
  ['queued', 'Wartet'],
  ['cancelled', 'Abgebrochen'],
] as const

const ZEIT_OPTIONEN = [
  ['24h', 'Letzte 24 Stunden'],
  ['7d', 'Letzte 7 Tage'],
  ['30d', 'Letzte 30 Tage'],
  ['alle', 'Gesamter Zeitraum'],
] as const

export default async function AusfuehrungenSeite({
  searchParams,
}: {
  searchParams: { automation?: string; status?: string; zeitraum?: string; seite?: string }
}) {
  await nutzerErzwingen()

  const seite = Math.max(1, Number(searchParams.seite ?? '1') || 1)
  const proSeite = 50
  const zeitraum = (searchParams.zeitraum as '24h' | '7d' | '30d' | 'alle') ?? '7d'

  const [automationen, ergebnis] = await Promise.all([
    automationenMitKennzahlen(),
    ausfuehrungen({
      automationId: searchParams.automation || undefined,
      status: searchParams.status,
      zeitraum,
      limit: proSeite,
      offset: (seite - 1) * proSeite,
    }),
  ])

  const seiten = Math.max(1, Math.ceil(ergebnis.gesamt / proSeite))
  const linkMit = (änderung: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(searchParams.automation ? { automation: searchParams.automation } : {}),
      ...(searchParams.status ? { status: searchParams.status } : {}),
      zeitraum,
      ...änderung,
    })
    return '/executions?' + p.toString()
  }

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Ausführungen</h1>
        <span className="schwach klein">{zahl(ergebnis.gesamt)} Treffer</span>
      </div>

      <form className="filter-leiste karte" style={{ padding: 12 }} method="get">
        <div className="feld">
          <label htmlFor="automation">Automation</label>
          <select id="automation" name="automation" defaultValue={searchParams.automation ?? ''}>
            <option value="">Alle</option>
            {automationen.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="feld">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={searchParams.status ?? 'alle'}>
            {STATUS_OPTIONEN.map(([wert, text]) => (
              <option key={wert} value={wert}>{text}</option>
            ))}
          </select>
        </div>

        <div className="feld">
          <label htmlFor="zeitraum">Zeitraum</label>
          <select id="zeitraum" name="zeitraum" defaultValue={zeitraum}>
            {ZEIT_OPTIONEN.map(([wert, text]) => (
              <option key={wert} value={wert}>{text}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn--klein btn--primaer">Filtern</button>
        <Link href="/executions" className="btn btn--klein">Zurücksetzen</Link>
      </form>

      <section className="karte">
        {ergebnis.zeilen.length === 0 ? (
          <Leer titel="Keine Ausführungen gefunden" text="Andere Filter oder einen größeren Zeitraum wählen." />
        ) : (
          <div className="tabelle-huelle">
            <table className="tabelle">
              <thead>
                <tr>
                  <th>Start</th>
                  <th>Automation</th>
                  <th>Status</th>
                  <th>Auslöser</th>
                  <th style={{ textAlign: 'right' }}>Dauer</th>
                  <th style={{ textAlign: 'right' }}>Datensätze</th>
                  <th>Meldung</th>
                </tr>
              </thead>
              <tbody>
                {ergebnis.zeilen.map((e) => (
                  <tr key={e.id}>
                    <td className="klein">
                      <Link href={'/executions/' + e.id} className="zeilen-link">{datumZeit(e.started_at)}</Link>
                    </td>
                    <td className="klein">
                      <Link href={'/automationen/' + e.automation_id}>{e.automation_name}</Link>
                    </td>
                    <td><LaufStatusPlakette status={e.status} /></td>
                    <td className="klein schwach">
                      {AUSLOESER_LABEL[e.trigger] ?? e.trigger}
                      {e.ausgeloest_von ? <div className="klein schwach">{e.ausgeloest_von}</div> : null}
                    </td>
                    <td className="zahl schwach">{dauer(e.duration_ms)}</td>
                    <td className="zahl schwach">{zahl(e.items_processed)}</td>
                    <td className="klein" style={{ color: e.error_message ? '#ff9c9c' : 'var(--text-schwach)', maxWidth: 340 }}>
                      {e.error_message ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {seiten > 1 ? (
        <nav className="reihe" aria-label="Seiten">
          <Link
            href={linkMit({ seite: String(seite - 1) })}
            className="btn btn--klein"
            aria-disabled={seite <= 1}
            style={seite <= 1 ? { pointerEvents: 'none', opacity: 0.45 } : undefined}
          >
            Zurück
          </Link>
          <span className="klein schwach">Seite {seite} von {seiten}</span>
          <Link
            href={linkMit({ seite: String(seite + 1) })}
            className="btn btn--klein"
            aria-disabled={seite >= seiten}
            style={seite >= seiten ? { pointerEvents: 'none', opacity: 0.45 } : undefined}
          >
            Weiter
          </Link>
        </nav>
      ) : null}
    </main>
  )
}
