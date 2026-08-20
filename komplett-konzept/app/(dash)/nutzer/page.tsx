import { ROLLEN_LABEL, istAdmin, nutzerErzwingen } from '@/lib/auth'
import { datumZeit, relativeZeit } from '@/lib/format'
import { nutzerListe } from '@/lib/queries'
import { NutzerFormular } from './NutzerFormular'
import { NutzerAktionen } from './NutzerZeile'

export const metadata = { title: 'Nutzer' }
export const dynamic = 'force-dynamic'

export default async function NutzerSeite() {
  const ich = await nutzerErzwingen()
  const admin = istAdmin(ich)
  const nutzer = await nutzerListe()

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Nutzer</h1>
        <span className="schwach klein">{nutzer.length} angelegt</span>
      </div>

      {!admin ? (
        <p className="meldung meldung--hinweis">
          Du siehst die Liste, aber nur Administratoren dürfen Nutzer anlegen oder ändern.
        </p>
      ) : null}

      <div className="zwei-spalten">
        <section className="karte">
          <div className="karte__kopf"><h2>Alle Nutzer</h2></div>
          <div className="tabelle-huelle">
            <table className="tabelle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th>Zuletzt angemeldet</th>
                  <th>Status</th>
                  {admin ? <th>Aktionen</th> : null}
                </tr>
              </thead>
              <tbody>
                {nutzer.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <span className="zeilen-link">{n.name}</span>
                      {n.id === ich.id ? <span className="klein schwach"> (du)</span> : null}
                    </td>
                    <td className="klein schwach">{n.email}</td>
                    <td className="klein">{ROLLEN_LABEL[n.role]}</td>
                    <td className="klein schwach" title={datumZeit(n.last_login_at)}>
                      {n.last_login_at ? relativeZeit(n.last_login_at) : 'nie'}
                    </td>
                    <td>
                      <span className={'status status--' + (n.is_active ? 'ok' : 'neutral')}>
                        <span className="status__punkt" />
                        {n.is_active ? 'Aktiv' : 'Gesperrt'}
                      </span>
                    </td>
                    {admin ? (
                      <td><NutzerAktionen nutzer={n} istIchSelbst={n.id === ich.id} /></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {admin ? (
          <aside className="karte">
            <div className="karte__kopf"><h2>Neuen Nutzer anlegen</h2></div>
            <div className="karte__koerper">
              <NutzerFormular />
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  )
}
