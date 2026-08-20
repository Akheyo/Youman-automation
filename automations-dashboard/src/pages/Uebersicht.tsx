import { useMemo } from 'react';
import { useDaten } from '../lib/data';
import Zustandsbalken, { lageBestimmen } from '../components/Zustandsbalken';
import Trend from '../components/Trend';
import { DurchlaufListe } from '../components/Durchlaeufe';
import { Etikett, LeererZustand, Meldung } from '../components/Bausteine';
import { anzahl, prozent, relativ } from '../lib/format';
import { automationText, automationTon, schwereText, schwereTon } from '../lib/labels';

function Kennzahl({ wert, name, hinweis }: { wert: string; name: string; hinweis?: string }) {
  return (
    <div className="kennzahl">
      <div className="kennzahlWert">{wert}</div>
      <div className="kennzahlName">{name}</div>
      {hinweis && <div className="kennzahlHinweis">{hinweis}</div>}
    </div>
  );
}

export default function Uebersicht({ gehZu }: { gehZu: (ziel: string) => void }) {
  const { kennzahlen, trend, automationen, fehler, laufende, ersteLadung, laden, warnungen } = useDaten();

  const lage = useMemo(
    () => lageBestimmen(automationen, fehler, laufende, kennzahlen),
    [automationen, fehler, laufende, kennzahlen],
  );

  const namen = useMemo(
    () => new Map(automationen.map((eintrag) => [eintrag.id, eintrag.name])),
    [automationen],
  );

  const quote =
    kennzahlen && kennzahlen.erfolgreich + kennzahlen.fehlerhaft > 0
      ? (kennzahlen.erfolgreich / (kennzahlen.erfolgreich + kennzahlen.fehlerhaft)) * 100
      : null;

  const dringend = fehler.slice(0, 3);
  const auffaellig = automationen.filter(
    (eintrag) => eintrag.status === 'error' || eintrag.status === 'paused' || eintrag.status === 'stopped',
  );

  if (ersteLadung && laden) return <p className="laden">Die Übersicht wird geladen.</p>;

  return (
    <>
      <Zustandsbalken lage={lage} />

      {warnungen.length > 0 && (
        <Meldung ton="rot">
          <strong>Ein Teil der Daten fehlt gerade.</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {warnungen.map((warnung) => (
              <li key={warnung}>{warnung}</li>
            ))}
          </ul>
        </Meldung>
      )}

      <section className="kennzahlen">
        <Kennzahl
          wert={anzahl(kennzahlen?.gesamt ?? 0)}
          name="Durchläufe in 24 Stunden"
          hinweis={quote === null ? 'noch keine Angabe' : `${prozent(quote)} davon erfolgreich`}
        />
        <Kennzahl wert={anzahl(kennzahlen?.erfolgreich ?? 0)} name="davon erfolgreich" />
        <Kennzahl
          wert={anzahl(kennzahlen?.fehlerhaft ?? 0)}
          name="davon fehlgeschlagen"
          hinweis={(kennzahlen?.fehlerhaft ?? 0) > 0 ? 'im Bereich Fehler nachsehen' : 'nichts zu tun'}
        />
        <Kennzahl
          wert={anzahl(fehler.length)}
          name="offene Fehler"
          hinweis={fehler.length > 0 ? 'warten auf jemanden' : 'alles abgehakt'}
        />
        <Kennzahl
          wert={anzahl(laufende.length)}
          name="läuft gerade"
          hinweis={laufende.length > 0 ? 'in diesem Moment' : 'gerade läuft nichts'}
        />
      </section>

      <section className="karte">
        <div className="karteKopf">
          <h2>Was gerade läuft</h2>
          <span className="leise">in diesem Moment</span>
        </div>
        <DurchlaufListe
          durchlaeufe={laufende}
          namen={namen}
          leerTitel="Gerade läuft nichts"
          leerText="Sobald eine Automation startet, steht sie hier. Du kannst eine auch von Hand anstoßen."
        />
      </section>

      <section className="karte">
        <div className="karteKopf">
          <h2>Zuverlässigkeit der letzten 14 Tage</h2>
          <span className="leise">Erfolgsquote pro Tag</span>
        </div>
        <Trend tage={trend} />
      </section>

      <section className="karte">
        <div className="karteKopf">
          <h2>Fehler, die warten</h2>
          <button type="button" className="knopf knopfLeise" onClick={() => gehZu('#/fehler')}>
            Alle Fehler ansehen
          </button>
        </div>
        {dringend.length === 0 ? (
          <LeererZustand
            titel="Kein offener Fehler"
            text="Es liegt nichts an. Wenn etwas schiefgeht, steht es hier und im Bereich Fehler."
          />
        ) : (
          <div className="liste">
            {dringend.map((eintrag) => (
              <button
                key={eintrag.id}
                type="button"
                className="zeileKopf zeile"
                onClick={() => gehZu('#/fehler')}
              >
                <Etikett ton={schwereTon[eintrag.severity]} text={schwereText[eintrag.severity]} />
                <span className="zeileTitel">
                  <span className="zeileName">{eintrag.title ?? 'Fehler ohne Titel'}</span>
                  <span className="zeileUnter">
                    {eintrag.automationName ? `${eintrag.automationName}, ` : ''}
                    {relativ(eintrag.created_at)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="karte">
        <div className="karteKopf">
          <h2>Automationen, die auffallen</h2>
          <button type="button" className="knopf knopfLeise" onClick={() => gehZu('#/automationen')}>
            Alle Automationen ansehen
          </button>
        </div>
        {auffaellig.length === 0 ? (
          <LeererZustand
            titel="Alle Automationen laufen"
            text="Keine steht, keine ist angehalten, keine meldet ein Problem."
          />
        ) : (
          <div className="liste">
            {auffaellig.map((eintrag) => (
              <button
                key={eintrag.id}
                type="button"
                className="zeileKopf zeile"
                onClick={() => gehZu(`#/automationen/${eintrag.id}`)}
              >
                <Etikett ton={automationTon[eintrag.status]} text={automationText[eintrag.status]} />
                <span className="zeileTitel">
                  <span className="zeileName">{eintrag.name}</span>
                  <span className="zeileUnter">
                    Zuletzt gelaufen {relativ(eintrag.lastRunAt)}
                    {eintrag.offeneFehler > 0
                      ? `, ${anzahl(eintrag.offeneFehler)} ${eintrag.offeneFehler === 1 ? 'offener Fehler' : 'offene Fehler'}`
                      : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
