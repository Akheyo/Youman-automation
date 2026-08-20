import { ROLLEN_LABEL, nutzerErzwingen } from '@/lib/auth'
import { datumZeit } from '@/lib/format'
import { sql } from '@/lib/db'

export const metadata = { title: 'Einstellungen' }
export const dynamic = 'force-dynamic'

export default async function EinstellungenSeite() {
  const nutzer = await nutzerErzwingen()

  const [{ version }] = await sql<{ version: string }[]>`select version()`
  const [zahlen] = await sql<{ automationen: number; laeufe: number; fehler: number; logs: number }[]>`
    select
      (select count(*) from automations)::int    as automationen,
      (select count(*) from executions)::int     as laeufe,
      (select count(*) from errors)::int         as fehler,
      (select count(*) from execution_logs)::int as logs
  `
  const migrationen = await sql<{ name: string; applied_at: Date }[]>`
    select name, applied_at from _migrations order by name
  `

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Einstellungen</h1>
      </div>

      <div className="zwei-spalten">
        <div className="spalte">
          <section className="karte">
            <div className="karte__kopf"><h2>Anbindung der Automationen</h2></div>
            <div className="karte__koerper spalte">
              <p className="gedaempft klein">
                Das Dashboard steht — die Ausführungsschicht kommt als nächster Schritt.
                Bis dahin gilt:
              </p>
              <ul className="gedaempft klein" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                <li>„Jetzt ausführen“ legt einen Lauf mit Status <em>wartet</em> an.</li>
                <li>Aktiv/Pausiert wird gespeichert und ist später für die Runner verbindlich.</li>
                <li>Fehler lassen sich schon jetzt übernehmen und abhaken.</li>
                <li>Jede Steuer-Aktion landet im Protokoll.</li>
              </ul>
              <p className="meldung meldung--info klein">
                Die Tabellen <code className="mono">automations</code>, <code className="mono">executions</code>,{' '}
                <code className="mono">execution_logs</code> und <code className="mono">errors</code> sind so
                angelegt, dass n8n, Cronjobs oder Python-Skripte direkt hineinschreiben können.
              </p>
            </div>
          </section>

          <section className="karte">
            <div className="karte__kopf"><h2>Rollen und Rechte</h2></div>
            <div className="tabelle-huelle">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th>Rolle</th>
                    <th>Ansehen</th>
                    <th>Steuern</th>
                    <th>Nutzer verwalten</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Betrachter</td><td>ja</td><td>nein</td><td>nein</td></tr>
                  <tr><td>Bediener</td><td>ja</td><td>ja</td><td>nein</td></tr>
                  <tr><td>Administrator</td><td>ja</td><td>ja</td><td>ja</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="spalte">
          <section className="karte">
            <div className="karte__kopf"><h2>Dein Zugang</h2></div>
            <div className="karte__koerper">
              <dl className="dl">
                <dt>Name</dt><dd>{nutzer.name}</dd>
                <dt>E-Mail</dt><dd>{nutzer.email}</dd>
                <dt>Rolle</dt><dd>{ROLLEN_LABEL[nutzer.role]}</dd>
                <dt>Zuletzt angemeldet</dt><dd>{datumZeit(nutzer.last_login_at)}</dd>
              </dl>
            </div>
          </section>

          <section className="karte">
            <div className="karte__kopf"><h2>System</h2></div>
            <div className="karte__koerper">
              <dl className="dl">
                <dt>Automationen</dt><dd>{zahlen.automationen}</dd>
                <dt>Laeufe</dt><dd>{zahlen.laeufe}</dd>
                <dt>Fehler</dt><dd>{zahlen.fehler}</dd>
                <dt>Log-Zeilen</dt><dd>{zahlen.logs}</dd>
                <dt>Datenbank</dt><dd className="klein schwach">{version.split(' ').slice(0, 2).join(' ')}</dd>
                <dt>Migrationen</dt><dd className="klein schwach">{migrationen.length} angewendet</dd>
              </dl>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
