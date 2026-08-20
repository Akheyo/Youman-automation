import { anzahl, prozent, tagKurz, wochentagKurz } from '../lib/format';
import { LeererZustand } from './Bausteine';
import type { Trendtag } from '../lib/types';

function saeulenFarbe(quote: number | null): string {
  if (quote === null) return 'var(--rand)';
  if (quote >= 95) return 'var(--blau)';
  if (quote >= 80) return 'var(--gelb)';
  return 'var(--rot)';
}

/** Ein Tag ist eine Säule. Höhe ist die Erfolgsquote, Farbe sagt, wie gut das ist. */
export default function Trend({ tage }: { tage: Trendtag[] }) {
  if (tage.length === 0) {
    return (
      <LeererZustand
        titel="Noch kein Verlauf"
        text="Sobald die ersten Durchläufe da sind, siehst du hier, ob es besser oder schlechter wird."
      />
    );
  }

  const mitQuote = tage.filter((tag) => tag.quote !== null);
  const erste = mitQuote.slice(0, Math.max(1, Math.floor(mitQuote.length / 2)));
  const letzte = mitQuote.slice(Math.max(1, Math.floor(mitQuote.length / 2)));
  const schnitt = (liste: Trendtag[]) =>
    liste.length === 0 ? null : liste.reduce((summe, tag) => summe + (tag.quote ?? 0), 0) / liste.length;

  const vorher = schnitt(erste);
  const nachher = schnitt(letzte);
  let satz = 'Für einen Vergleich sind noch zu wenige Tage da.';
  if (vorher !== null && nachher !== null) {
    const unterschied = nachher - vorher;
    if (Math.abs(unterschied) < 1) satz = 'Die Lage ist so stabil wie in der Woche davor.';
    else if (unterschied > 0) satz = `Es ist besser geworden, um ${prozent(Math.abs(unterschied), 1)} gegenüber der Woche davor.`;
    else satz = `Es ist schlechter geworden, um ${prozent(Math.abs(unterschied), 1)} gegenüber der Woche davor.`;
  }

  return (
    <div>
      <div className="trend">
        {tage.map((tag) => {
          const hoehe = tag.quote === null ? 4 : Math.max(4, Math.round(tag.quote));
          return (
            <div key={tag.tag} className="trendTag">
              <div
                className="trendSaeule"
                style={{ height: `${hoehe}%`, background: saeulenFarbe(tag.quote) }}
                title={`${tagKurz(tag.tag)}: ${prozent(tag.quote)} erfolgreich bei ${anzahl(tag.gesamt)} Durchläufen`}
              />
              <div className="trendTagName">{wochentagKurz(tag.tag)}</div>
            </div>
          );
        })}
      </div>
      <p className="leise" style={{ marginTop: 10 }}>
        {satz}
      </p>
    </div>
  );
}
