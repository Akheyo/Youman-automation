import Link from 'next/link'
import { AutomationStatusPlakette, LaufStatusPlakette, QUELLE_LABEL } from '@/components/Status'
import { AutomationSteuerung } from '@/components/Steuerung'
import { Leer } from '@/components/Leer'
import { darfSteuern, nutzerErzwingen } from '@/lib/auth'
import { dauer, prozent, relativeZeit, zahl } from '@/lib/format'
import { automationenMitKennzahlen } from '@/lib/queries'

export const metadata = { title: 'Automationen' }
export const dynamic = 'force-dynamic'

export default async function AutomationenSeite() {
  const nutzer = await nutzerErzwingen()
  const steuern = darfSteuern(nutzer)
  const automationen = await automationenMitKennzahlen()

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Automationen</h1>
        <span className="schwach klein">{automationen.length} eingetragen</span>
      </div>

      <p className="meldung meldung--hinweis">
        Die Steuerung ist angelegt, aber noch nicht mit einer Ausführungsschicht verbunden.
        „Jetzt ausführen“ reiht einen Lauf ein — abgearbeitet wird er, sobald die Automationen angebunden sind.
      </p>

      <section className="karte">
        {automationen.length === 0 ? (
          <Leer titel="Noch keine Automationen" text="Beispieldaten anlegen mit: npm run db:seed" />
        ) : (
          <div className="tabelle-huelle">
            <table className="tabelle">
              <thead>
                <tr>
                  <th>Automation</th>
                  <th>Status</th>
                  <th>Quelle</th>
                  <th>Zeitplan</th>
                  <th>Letzter Lauf</th>
                  <th style={{ textAlign: 'right' }}>24 Std</th>
                  <th style={{ textAlign: 'right' }}>Erfolg</th>
                  <th style={{ textAlign: 'right' }}>Fehler</th>
                  <th>Steuerung</th>
                </tr>
              </thead>
              <tbody>
                {automationen.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={'/automationen/' + a.id} className="zeilen-link">{a.name}</Link>
                      <div className="klein schwach">{a.category ?? '—'}</div>
                    </td>
                    <td><AutomationStatusPlakette status={a.status} /></td>
                    <td className="klein">{QUELLE_LABEL[a.source] ?? a.source}</td>
                    <td className="klein schwach">
                      {a.schedule_label ?? '—'}
                      {a.schedule_cron ? <div className="mono schwach">{a.schedule_cron}</div> : null}
                    </td>
                    <td className="klein">
                      {relativeZeit(a.last_run_at)}
                      {a.letzter_status ? (
                        <div style={{ marginTop: 3 }}><LaufStatusPlakette status={a.letzter_status} /></div>
                      ) : null}
                    </td>
                    <td className="zahl">{zahl(a.laeufe_24h)}</td>
                    <td className="zahl" style={{ color: (a.erfolgsquote ?? 100) < 90 ? 'var(--warn)' : undefined }}>
                      {prozent(a.erfolgsquote, 0)}
                    </td>
                    <td className="zahl" style={{ color: a.offene_fehler > 0 ? 'var(--fehler)' : undefined }}>
                      {a.offene_fehler}
                    </td>
                    <td><AutomationSteuerung id={a.id} status={a.status} darfSteuern={steuern} klein /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
