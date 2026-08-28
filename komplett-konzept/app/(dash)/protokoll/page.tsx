import { Leer } from '@/components/Leer'
import { nutzerErzwingen } from '@/lib/auth'
import { datumZeit, relativeZeit } from '@/lib/format'
import { protokoll } from '@/lib/queries'

export const metadata = { title: 'Protokoll' }
export const dynamic = 'force-dynamic'

const AKTION_TEXT: Record<string, string> = {
  'automation.aktiviert': 'Automation aktiviert',
  'automation.pausiert': 'Automation pausiert',
  'automation.manuell_gestartet': 'Lauf manuell angestoßen',
  'lauf.wiederholt': 'Lauf wiederholt',
  'lauf.abgebrochen': 'Lauf abgebrochen',
  'fehler.übernommen': 'Fehler übernommen',
  'fehler.erledigt': 'Fehler als erledigt markiert',
  'fehler.wieder_geöffnet': 'Fehler wieder geöffnet',
  'fehler.sammel_erledigt': 'Mehrere Fehler erledigt',
  'nutzer.angelegt': 'Nutzer angelegt',
  'nutzer.aktiviert': 'Nutzer aktiviert',
  'nutzer.deaktiviert': 'Nutzer gesperrt',
  'nutzer.rolle_geändert': 'Rolle geändert',
}

export default async function ProtokollSeite() {
  await nutzerErzwingen()
  const eintraege = await protokoll(200)

  return (
    <main className="seite">
      <div className="abschnitt-kopf">
        <h1>Protokoll</h1>
        <span className="schwach klein">Wer hat wann was gesteuert</span>
      </div>

      <section className="karte">
        {eintraege.length === 0 ? (
          <Leer titel="Noch nichts protokolliert" text="Sobald jemand etwas steuert, steht es hier." />
        ) : (
          <div className="tabelle-huelle">
            <table className="tabelle">
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Person</th>
                  <th>Aktion</th>
                  <th>Betrifft</th>
                </tr>
              </thead>
              <tbody>
                {eintraege.map((e) => (
                  <tr key={e.id}>
                    <td className="klein" title={datumZeit(e.at)}>{relativeZeit(e.at)}</td>
                    <td className="klein">{e.user_name ?? 'System'}</td>
                    <td className="klein">{AKTION_TEXT[e.action] ?? e.action}</td>
                    <td className="klein schwach">
                      {e.target_name ?? e.target_id?.slice(0, 8) ?? '—'}
                    </td>
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
