import { useState } from 'react';
import { useAnmeldung } from '../lib/auth';
import { useDaten } from '../lib/data';
import { fehlerErledigen, fehlerUebernehmen } from '../lib/queries';
import { useHinweise } from '../components/Hinweise';
import { Etikett, LeererZustand, WertPaar } from '../components/Bausteine';
import { anzahl, relativ, zeitpunkt } from '../lib/format';
import { fehlerStatusText, schwereText, schwereTon } from '../lib/labels';
import type { OffenerFehler } from '../lib/types';

const randKlassen: Record<string, string> = {
  kritisch: 'fehlerKritisch',
  hoch: 'fehlerHoch',
  mittel: 'fehlerMittel',
  niedrig: 'fehlerNiedrig',
};

function FehlerKarte({ fehler, gehZu }: { fehler: OffenerFehler; gehZu: (ziel: string) => void }) {
  const { session, darfSteuern } = useAnmeldung();
  const { neuLaden, profilName } = useDaten();
  const { zeigen } = useHinweise();
  const [laeuft, setLaeuft] = useState(false);

  const uebernehmen = async () => {
    if (!session?.user) return;
    setLaeuft(true);
    try {
      await fehlerUebernehmen(fehler.id, session.user.id);
      zeigen('Ist notiert. Der Fehler steht jetzt auf deinem Namen.');
      await neuLaden();
    } catch (problem) {
      zeigen(problem instanceof Error ? problem.message : 'Das hat nicht geklappt.', 'rot');
    } finally {
      setLaeuft(false);
    }
  };

  const erledigen = async () => {
    if (!session?.user) return;
    setLaeuft(true);
    try {
      await fehlerErledigen(fehler.id, session.user.id);
      zeigen('Abgehakt. Der Fehler ist aus der Liste.');
      await neuLaden();
    } catch (problem) {
      zeigen(problem instanceof Error ? problem.message : 'Das hat nicht geklappt.', 'rot');
    } finally {
      setLaeuft(false);
    }
  };

  const schonUebernommen = fehler.status === 'in_progress';

  return (
    <article className={`karte fehlerKarte ${randKlassen[fehler.severity] ?? ''}`}>
      <div className="karteKopf">
        <Etikett ton={schwereTon[fehler.severity]} text={schwereText[fehler.severity]} />
        <h2>{fehler.title ?? 'Fehler ohne Titel'}</h2>
        <span className="leise">{relativ(fehler.created_at)}</span>
      </div>

      <p>{fehler.message_readable ?? 'Zu diesem Fehler gibt es keine Beschreibung im Klartext.'}</p>

      <hr className="trennlinie" />

      <div className="wertePaare">
        <WertPaar name="Automation" wert={fehler.automationName ?? 'nicht zugeordnet'} />
        <WertPaar name="Aufgetreten" wert={zeitpunkt(fehler.created_at)} />
        <WertPaar name="Zustand" wert={fehlerStatusText[fehler.status] ?? fehler.status} />
        <WertPaar
          name="Kümmert sich"
          wert={fehler.assigned_to ? profilName(fehler.assigned_to) : 'noch niemand'}
        />
      </div>

      <div className="knopfReihe" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="knopf"
          onClick={uebernehmen}
          disabled={!darfSteuern || laeuft || schonUebernommen}
          title={darfSteuern ? undefined : 'Dafür fehlt dir das Recht zum Steuern.'}
        >
          {schonUebernommen ? `${profilName(fehler.assigned_to)} kümmert sich` : 'Kümmere ich mich drum'}
        </button>
        <button
          type="button"
          className="knopf knopfHaupt"
          onClick={erledigen}
          disabled={!darfSteuern || laeuft}
          title={darfSteuern ? undefined : 'Dafür fehlt dir das Recht zum Steuern.'}
        >
          Erledigt
        </button>
        {fehler.automation_id && (
          <button
            type="button"
            className="knopf knopfLeise"
            onClick={() => gehZu(`#/automationen/${fehler.automation_id}`)}
          >
            Zur Automation springen
          </button>
        )}
      </div>

      {!darfSteuern && (
        <p className="knopfGrund" style={{ marginTop: 8, maxWidth: 'none' }}>
          Du darfst zuschauen, nicht steuern. Amanuel kann dir das Recht geben.
        </p>
      )}
    </article>
  );
}

export default function Fehler({ gehZu }: { gehZu: (ziel: string) => void }) {
  const { fehler, ersteLadung, laden } = useDaten();
  const [nurSchwere, setNurSchwere] = useState('alle');

  const gefiltert = fehler.filter((eintrag) => nurSchwere === 'alle' || eintrag.severity === nurSchwere);

  if (ersteLadung && laden) return <p className="laden">Die Fehler werden geladen.</p>;

  return (
    <>
      <div className="karteKopf">
        <h1>Fehler</h1>
        <span className="leise">
          {fehler.length === 0
            ? 'nichts offen'
            : `${anzahl(fehler.length)} offen, schlimmste zuerst`}
        </span>
      </div>

      <div className="werkzeugleiste">
        <select value={nurSchwere} onChange={(ereignis) => setNurSchwere(ereignis.target.value)} style={{ width: 'auto' }}>
          <option value="alle">Alle Schweregrade</option>
          <option value="kritisch">Nur kritisch</option>
          <option value="hoch">Nur hoch</option>
          <option value="mittel">Nur mittel</option>
          <option value="niedrig">Nur niedrig</option>
        </select>
      </div>

      {gefiltert.length === 0 ? (
        <LeererZustand
          titel={fehler.length === 0 ? 'Kein offener Fehler' : 'In dieser Auswahl ist nichts offen'}
          text={
            fehler.length === 0
              ? 'Es liegt nichts an. Wenn eine Automation stolpert, landet der Fehler hier, schlimmster zuerst.'
              : 'Wähle einen anderen Schweregrad, um die übrigen Fehler zu sehen.'
          }
        />
      ) : (
        <div className="liste">
          {gefiltert.map((eintrag) => (
            <FehlerKarte key={eintrag.id} fehler={eintrag} gehZu={gehZu} />
          ))}
        </div>
      )}
    </>
  );
}
