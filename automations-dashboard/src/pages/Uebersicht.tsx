import { useMemo } from 'react';
import { useDaten } from '../lib/data';
import Zustandsbalken, { lageBestimmen } from '../components/Zustandsbalken';
import Trend from '../components/Trend';
import { DurchlaufListe } from '../components/Durchlaeufe';
import { Etikett, LeererZustand, Meldung, QuoteBalken, Skelett, SkelettKarten } from '../components/Bausteine';
import Zeichen, { type ZeichenName } from '../components/Icons';
import { anzahl, prozent, relativ } from '../lib/format';
import {
  automationText,
  automationTon,
  automationZeichen,
  schwereText,
  schwereTon,
  schwereZeichen,
} from '../lib/labels';

function Kennzahl({
  wert,
  name,
  zeichen,
  hinweis,
  farbe,
  anteil,
}: {
  wert: string;
  name: string;
  zeichen: ZeichenName;
  hinweis?: string;
  farbe?: 'blau' | 'gelb' | 'rot';
  anteil?: number | null;
}) {
  const farbklasse = farbe === 'rot' ? 'kennzahlWertRot' : farbe === 'gelb' ? 'kennzahlWertGelb' : farbe === 'blau' ? 'kennzahlWertBlau' : '';
  return (
    <div className="kennzahl">
      <div className="kennzahlName">
        <Zeichen name={zeichen} groesse={14} />
        {name}
      </div>
      <div className={`kennzahlWert ${farbklasse}`}>{wert}</div>
      {hinweis && <div className="kennzahlHinweis">{hinweis}</div>}
      {anteil !== undefined && anteil !== null && (
        <div className="kennzahlBalken" aria-hidden="true">
          <div className="kennzahlBalkenFuellung" style={{ width: `${Math.max(2, Math.min(100, anteil))}%` }} />
        </div>
      )}
    </div>
  );
}

function KennzahlenSkelett() {
  return (
    <section className="kennzahlen" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="kennzahl">
          <Skelett breite="60%" hoehe={12} />
          <Skelett breite="45%" hoehe={26} />
          <Skelett breite="80%" hoehe={11} />
        </div>
      ))}
    </section>
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

  const abgeschlossen = (kennzahlen?.erfolgreich ?? 0) + (kennzahlen?.fehlerhaft ?? 0);
  const quote = abgeschlossen > 0 ? ((kennzahlen?.erfolgreich ?? 0) / abgeschlossen) * 100 : null;

  const dringend = fehler.slice(0, 3);
  const auffaellig = automationen.filter(
    (eintrag) => eintrag.status === 'error' || eintrag.status === 'paused' || eintrag.status === 'stopped',
  );

  if (ersteLadung && laden) {
    return (
      <>
        <div className="skelettKarte" style={{ minHeight: 148 }} aria-busy="true">
          <Skelett breite="34%" hoehe={22} />
          <Skelett breite="70%" hoehe={14} />
          <Skelett breite="52%" hoehe={14} />
        </div>
        <KennzahlenSkelett />
        <SkelettKarten anzahl={2} zeilen={3} />
      </>
    );
  }

  return (
    <>
      <Zustandsbalken lage={lage} gehZu={gehZu} />

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

      <section className="kennzahlen" aria-label="Kennzahlen der letzten 24 Stunden">
        <Kennzahl
          zeichen="puls"
          wert={anzahl(kennzahlen?.gesamt ?? 0)}
          name="Durchläufe"
          hinweis={
            quote === null ? 'letzte 24 Stunden' : `${prozent(quote)} erfolgreich, letzte 24 Stunden`
          }
          anteil={quote}
        />
        <Kennzahl
          zeichen="haken"
          wert={anzahl(kennzahlen?.erfolgreich ?? 0)}
          name="erfolgreich"
          farbe="blau"
          hinweis="in den letzten 24 Stunden"
        />
        <Kennzahl
          zeichen="warndreieck"
          wert={anzahl(kennzahlen?.fehlerhaft ?? 0)}
          name="fehlgeschlagen"
          farbe={(kennzahlen?.fehlerhaft ?? 0) > 0 ? 'rot' : undefined}
          hinweis={(kennzahlen?.fehlerhaft ?? 0) > 0 ? 'im Bereich Fehler nachsehen' : 'nichts zu tun'}
        />
        <Kennzahl
          zeichen="warnkreis"
          wert={anzahl(fehler.length)}
          name="offene Fehler"
          farbe={fehler.length > 0 ? 'gelb' : undefined}
          hinweis={fehler.length > 0 ? 'warten auf jemanden' : 'alles abgehakt'}
        />
        <Kennzahl
          zeichen="kreisel"
          wert={anzahl(laufende.length)}
          name="läuft gerade"
          hinweis={laufende.length > 0 ? 'in diesem Moment' : 'gerade läuft nichts'}
        />
      </section>

      <section className="karte" aria-label="Was gerade läuft">
        <div className="karteKopf">
          <h2>Was gerade läuft</h2>
          <span className="leise karteKopfRechts">in diesem Moment</span>
        </div>
        <DurchlaufListe
          durchlaeufe={laufende}
          namen={namen}
          leerTitel="Gerade läuft nichts"
          leerText="Sobald eine Automation startet, steht sie hier. Du kannst eine auch von Hand anstoßen."
        />
      </section>

      <section className="karte" aria-label="Zuverlässigkeit der letzten 14 Tage">
        <div className="karteKopf">
          <h2>Zuverlässigkeit der letzten 14 Tage</h2>
          <span className="leise karteKopfRechts">Erfolgsquote pro Tag</span>
        </div>
        <Trend tage={trend} />
      </section>

      <section className="karte" aria-label="Fehler, die warten">
        <div className="karteKopf">
          <h2>Fehler, die warten</h2>
          <div className="karteKopfRechts">
            <button type="button" className="knopf knopfLeise knopfKlein" onClick={() => gehZu('#/fehler')}>
              Alle Fehler
              <Zeichen name="pfeilRechts" groesse={14} />
            </button>
          </div>
        </div>
        {dringend.length === 0 ? (
          <LeererZustand
            titel="Kein offener Fehler"
            text="Es liegt nichts an. Wenn etwas schiefgeht, steht es hier und im Bereich Fehler."
            zeichen="schild"
          />
        ) : (
          <div className="liste">
            {dringend.map((eintrag) => (
              <div key={eintrag.id} className="zeile">
                <button type="button" className="zeileKopf" onClick={() => gehZu('#/fehler')}>
                  <Etikett
                    ton={schwereTon[eintrag.severity]}
                    text={schwereText[eintrag.severity]}
                    zeichen={schwereZeichen[eintrag.severity]}
                  />
                  <span className="zeileTitel">
                    <span className="zeileName">{eintrag.title ?? 'Fehler ohne Titel'}</span>
                    <span className="zeileUnter">
                      {eintrag.automationName ? `${eintrag.automationName}, ` : ''}
                      {relativ(eintrag.created_at)}
                    </span>
                  </span>
                  <span className="zeileRechts">
                    <Zeichen name="pfeilRechts" groesse={16} klasse="pfeil" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="karte" aria-label="Automationen, die auffallen">
        <div className="karteKopf">
          <h2>Automationen, die auffallen</h2>
          <div className="karteKopfRechts">
            <button type="button" className="knopf knopfLeise knopfKlein" onClick={() => gehZu('#/automationen')}>
              Alle Automationen
              <Zeichen name="pfeilRechts" groesse={14} />
            </button>
          </div>
        </div>
        {auffaellig.length === 0 ? (
          <LeererZustand
            titel="Alle Automationen laufen"
            text="Keine steht, keine ist angehalten, keine meldet ein Problem."
            zeichen="haken"
          />
        ) : (
          <div className="liste">
            {auffaellig.map((eintrag) => (
              <div key={eintrag.id} className="zeile">
                <button
                  type="button"
                  className="zeileKopf"
                  onClick={() => gehZu(`#/automationen/${eintrag.id}`)}
                >
                  <Etikett
                    ton={automationTon[eintrag.status]}
                    text={automationText[eintrag.status]}
                    zeichen={automationZeichen[eintrag.status]}
                  />
                  <span className="zeileTitel">
                    <span className="zeileName">{eintrag.name}</span>
                    <span className="zeileUnter">
                      Zuletzt gelaufen {relativ(eintrag.lastRunAt)}
                      {eintrag.offeneFehler > 0
                        ? `, ${anzahl(eintrag.offeneFehler)} ${
                            eintrag.offeneFehler === 1 ? 'offener Fehler' : 'offene Fehler'
                          }`
                        : ''}
                    </span>
                  </span>
                  <span className="zeileRechts">
                    <QuoteBalken quote={eintrag.zuverlaessigkeit14d} />
                    <Zeichen name="pfeilRechts" groesse={16} klasse="pfeil" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
