import { nurDatum } from '@/lib/format'

// Kleiner Balkenverlauf der letzten 14 Tage. Bewusst ohne Diagramm-Bibliothek:
// wenige Werte, klare Aussage, kein zusätzliches JavaScript im Browser.
export function Verlauf({ daten }: { daten: { tag: string; erfolg: number; fehler: number }[] }) {
  const max = Math.max(1, ...daten.map((d) => d.erfolg + d.fehler))

  return (
    <div className="verlauf" role="img" aria-label={'Laeufe der letzten ' + daten.length + ' Tage'}>
      {daten.map((d) => {
        const gesamt = d.erfolg + d.fehler
        const hoehe = gesamt === 0 ? 6 : Math.max(12, Math.round((gesamt / max) * 100))
        const fehlerAnteil = gesamt === 0 ? 0 : Math.round((d.fehler / gesamt) * 100)
        return (
          <div
            key={d.tag}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1, height: '100%' }}
            title={nurDatum(d.tag) + ': ' + d.erfolg + ' erfolgreich, ' + d.fehler + ' fehlgeschlagen'}
          >
            {fehlerAnteil > 0 ? (
              <div
                className="verlauf__balken verlauf__balken--fehler"
                style={{ height: (hoehe * fehlerAnteil) / 100 + '%', borderRadius: '1.5px 1.5px 0 0' }}
              />
            ) : null}
            <div
              className={'verlauf__balken' + (gesamt === 0 ? ' verlauf__balken--leer' : '')}
              style={{ height: (hoehe * (100 - fehlerAnteil)) / 100 + '%', borderRadius: fehlerAnteil > 0 ? 0 : '1.5px 1.5px 0 0' }}
            />
          </div>
        )
      })}
    </div>
  )
}
