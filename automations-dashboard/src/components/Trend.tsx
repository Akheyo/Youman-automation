import { useEffect, useMemo, useRef, useState } from 'react';
import { anzahl, prozent, tagKurz, wochentagKurz } from '../lib/format';
import { LeererZustand } from './Bausteine';
import type { Trendtag } from '../lib/types';

const HOEHE = 200;
const RAND = { oben: 16, rechts: 12, unten: 30, links: 38 };
const ZIEL = 95;

function pfadAus(punkte: Array<{ x: number; y: number }>): string {
  return punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/**
 * Erfolgsquote pro Tag als Linie. Die gestrichelte Linie ist das Ziel von 95 %,
 * damit man nicht rechnen muss, um zu sehen, ob ein Tag gut war.
 *
 * Neben dem Bild steht dieselbe Information als Tabelle für Vorleseprogramme,
 * und jeder Tag ist mit der Tastatur erreichbar.
 */
export default function Trend({ tage }: { tage: Trendtag[] }) {
  const huelle = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(720);
  const [aktiv, setAktiv] = useState<number | null>(null);

  useEffect(() => {
    const element = huelle.current;
    if (!element) return;
    const beobachter = new ResizeObserver((eintraege) => {
      const gemessen = eintraege[0]?.contentRect.width ?? 720;
      setBreite(Math.max(280, gemessen));
    });
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, []);

  const mitQuote = useMemo(() => tage.filter((tag) => tag.quote !== null), [tage]);

  const satz = useMemo(() => {
    if (mitQuote.length < 4) return 'Für einen Vergleich sind noch zu wenige Tage da.';
    const mitte = Math.floor(mitQuote.length / 2);
    const schnitt = (liste: Trendtag[]) =>
      liste.length === 0 ? null : liste.reduce((summe, tag) => summe + (tag.quote ?? 0), 0) / liste.length;
    const vorher = schnitt(mitQuote.slice(0, mitte));
    const nachher = schnitt(mitQuote.slice(mitte));
    if (vorher === null || nachher === null) return 'Für einen Vergleich sind noch zu wenige Tage da.';
    const unterschied = nachher - vorher;
    if (Math.abs(unterschied) < 1) return 'Die Lage ist so stabil wie in der Woche davor.';
    return unterschied > 0
      ? `Es ist besser geworden, um ${prozent(Math.abs(unterschied), 1)} gegenüber der Woche davor.`
      : `Es ist schlechter geworden, um ${prozent(Math.abs(unterschied), 1)} gegenüber der Woche davor.`;
  }, [mitQuote]);

  if (tage.length === 0) {
    return (
      <LeererZustand
        titel="Noch kein Verlauf"
        text="Sobald die ersten Durchläufe da sind, siehst du hier, ob es besser oder schlechter wird."
        zeichen="puls"
      />
    );
  }

  const innenBreite = Math.max(60, breite - RAND.links - RAND.rechts);
  const innenHoehe = HOEHE - RAND.oben - RAND.unten;

  /*
   * Die Achse beginnt nicht immer bei null. Bei Erfolgsquoten liegen alle Tage
   * dicht beieinander, und bei null als Anfang sähe jeder Tag gleich aus. Der
   * Anfangswert steht deshalb unter dem Bild, damit niemand getäuscht wird.
   */
  const werte = mitQuote.map((tag) => tag.quote ?? 0);
  const kleinster = werte.length > 0 ? Math.min(...werte) : 0;
  const unten =
    werte.length === 0 ? 0 : Math.max(0, Math.min(90, Math.floor((Math.min(kleinster, ZIEL) - 4) / 10) * 10));
  const spanne = Math.max(1, 100 - unten);
  const schritt = tage.length > 1 ? innenBreite / (tage.length - 1) : 0;
  const bandbreite = tage.length > 0 ? innenBreite / Math.max(1, tage.length - 1) : innenBreite;

  const xVon = (index: number) => RAND.links + (tage.length > 1 ? index * schritt : innenBreite / 2);
  const yVon = (quote: number) =>
    RAND.oben + innenHoehe - ((Math.max(unten, Math.min(100, quote)) - unten) / spanne) * innenHoehe;

  const punkte = tage.map((tag, index) => ({
    x: xVon(index),
    y: yVon(tag.quote ?? unten),
    tag,
    index,
    bekannt: tag.quote !== null,
  }));

  const bekannte = punkte.filter((punkt) => punkt.bekannt);
  const linie = pfadAus(bekannte);
  const flaeche =
    bekannte.length > 1
      ? `${linie} L${bekannte[bekannte.length - 1]!.x.toFixed(1)} ${RAND.oben + innenHoehe} L${bekannte[0]!.x.toFixed(1)} ${
          RAND.oben + innenHoehe
        } Z`
      : '';

  const jederZweite = breite < 480;
  const gezeigt = aktiv !== null ? punkte[aktiv] : null;

  return (
    <div>
      <div className="diagrammHuelle" ref={huelle}>
        <svg
          className="diagramm"
          width={breite}
          height={HOEHE}
          viewBox={`0 0 ${breite} ${HOEHE}`}
          role="img"
          aria-label={`Erfolgsquote pro Tag über ${anzahl(tage.length)} Tage. ${satz}`}
        >
          <defs>
            <linearGradient id="verlaufFuellung" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--akzent)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--akzent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[unten, Math.round((unten + 100) / 2), 100].map((wert) => (
            <g key={wert}>
              <line
                className="diagrammGitter"
                x1={RAND.links}
                y1={yVon(wert)}
                x2={breite - RAND.rechts}
                y2={yVon(wert)}
              />
              <text className="diagrammBeschriftung" x={RAND.links - 8} y={yVon(wert) + 4} textAnchor="end">
                {wert}
              </text>
            </g>
          ))}

          <line
            className="diagrammZiel"
            x1={RAND.links}
            y1={yVon(ZIEL)}
            x2={breite - RAND.rechts}
            y2={yVon(ZIEL)}
          />

          {flaeche && <path d={flaeche} fill="url(#verlaufFuellung)" />}
          {bekannte.length > 1 && <path className="diagrammLinie" d={linie} />}

          {gezeigt && (
            <line
              className="diagrammFuehrung"
              x1={gezeigt.x}
              y1={RAND.oben}
              x2={gezeigt.x}
              y2={RAND.oben + innenHoehe}
            />
          )}

          {punkte.map((punkt) =>
            punkt.bekannt ? (
              <circle
                key={`p${punkt.index}`}
                cx={punkt.x}
                cy={punkt.y}
                r={aktiv === punkt.index ? 4 : 2.5}
                fill={aktiv === punkt.index ? 'var(--akzent)' : 'var(--grund)'}
                stroke="var(--akzent)"
                strokeWidth={1.5}
              />
            ) : null,
          )}

          {punkte.map((punkt) => (
            <text
              key={`t${punkt.index}`}
              className="diagrammBeschriftung"
              x={punkt.x}
              y={HOEHE - 10}
              textAnchor="middle"
              opacity={jederZweite && punkt.index % 2 === 1 ? 0 : 1}
            >
              {wochentagKurz(punkt.tag.tag)}
            </text>
          ))}

          {punkte.map((punkt) => (
            <rect
              key={`f${punkt.index}`}
              className="diagrammFeld"
              x={punkt.x - bandbreite / 2}
              y={RAND.oben}
              width={bandbreite}
              height={innenHoehe}
              tabIndex={0}
              role="button"
              aria-label={`${tagKurz(punkt.tag.tag)}: ${prozent(punkt.tag.quote)} erfolgreich bei ${anzahl(
                punkt.tag.gesamt,
              )} Durchläufen`}
              onMouseEnter={() => setAktiv(punkt.index)}
              onMouseLeave={() => setAktiv(null)}
              onFocus={() => setAktiv(punkt.index)}
              onBlur={() => setAktiv(null)}
            />
          ))}
        </svg>

        {gezeigt && (
          <div
            className="diagrammHinweis"
            style={{ left: `${(gezeigt.x / breite) * 100}%`, top: `${Math.max(0, gezeigt.y - 12)}px` }}
          >
            <span className="diagrammHinweisTag">{tagKurz(gezeigt.tag.tag)}</span>
            {prozent(gezeigt.tag.quote)} erfolgreich
            <br />
            {anzahl(gezeigt.tag.gesamt)} {gezeigt.tag.gesamt === 1 ? 'Durchlauf' : 'Durchläufe'}
          </div>
        )}
      </div>

      <div className="diagrammLegende">
        <span className="legendeStueck">
          <span className="legendeLinie" aria-hidden="true" />
          Erfolgsquote pro Tag
        </span>
        <span className="legendeStueck">
          <span className="legendeZiel" aria-hidden="true" />
          Ziel {ZIEL} Prozent
        </span>
        {unten > 0 && <span className="legendeStueck">Die Achse beginnt bei {unten} Prozent</span>}
      </div>

      <p className="leise" style={{ marginTop: 'var(--raum-2)' }}>
        {satz}
      </p>

      <table className="nurVorlesen">
        <caption>Erfolgsquote pro Tag, letzte 14 Tage</caption>
        <thead>
          <tr>
            <th scope="col">Tag</th>
            <th scope="col">Erfolgsquote</th>
            <th scope="col">Durchläufe</th>
          </tr>
        </thead>
        <tbody>
          {tage.map((tag) => (
            <tr key={tag.tag}>
              <td>{tagKurz(tag.tag)}</td>
              <td>{prozent(tag.quote)}</td>
              <td>{anzahl(tag.gesamt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
