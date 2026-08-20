import { useState } from 'react';
import { useAnmeldung } from '../lib/auth';
import { useDaten } from '../lib/data';
import { fehlerErledigen, fehlerUebernehmen } from '../lib/queries';
import { useHinweise } from '../components/Hinweise';
import { Etikett, LeererZustand, SkelettKarten, WertPaar } from '../components/Bausteine';
import Zeichen from '../components/Icons';
import { anzahl, relativ, zeitpunkt } from '../lib/format';
import { fehlerStatusText, fehlerStatusZeichen, schwereText, schwereTon, schwereZeichen } from '../lib/labels';
import type { FehlerSchwere, OffenerFehler } from '../lib/types';

const randKlassen: Record<FehlerSchwere, string> = {
  kritisch: 'fehlerKritisch',
  hoch: 'fehlerHoch',
  mittel: 'fehlerMittel',
  niedrig: 'fehlerNiedrig',
};

function FehlerKarte({ fehler, gehZu }: { fehler: OffenerFehler; gehZu: (ziel: string) => void }) {
  const { session, darfSteuern } = useAnmeldung();
  const { neuLaden, profilName } = useDaten();
  const { zeigen } = useHinweise();
  const [laeuft, setLaeuft] = useState<'uebernehmen' | 'erledigen' | null>(null);

  const uebernehmen = async () => {
    if (!session?.user) return;
    setLaeuft('uebernehmen');
    try {
      await fehlerUebernehmen(fehler.id, session.user.id);
      zeigen('Ist notiert. Der Fehler steht jetzt auf deinem Namen.');
      await neuLaden();
    } catch (problem) {
      zeigen(problem instanceof Error ? problem.message : 'Das hat nicht geklappt.', 'rot');
    } finally {
      setLaeuft(null);
    }
  };

  const erledigen = async () => {
    if (!session?.user) return;
    setLaeuft('erledigen');
    try {
      await fehlerErledigen(fehler.id, session.user.id);
      zeigen('Abgehakt. Der Fehler ist aus der Liste.');
      await neuLaden();
    } catch (problem) {
      zeigen(problem instanceof Error ? problem.message : 'Das hat nicht geklappt.', 'rot');
    } finally {
      setLaeuft(null);
    }
  };

  const schonUebernommen = fehler.status === 'in_progress';

  return (
    <article className={`karte fehlerKarte ${randKlassen[fehler.severity] ?? ''}`}>
      <div className="karteKopf" style={{ marginBottom: 'var(--raum-3)' }}>
        <Etikett
          ton={schwereTon[fehler.severity]}
          text={schwereText[fehler.severity]}
          zeichen={schwereZeichen[fehler.severity]}
        />
        <h2 className="fehlerTitel">{fehler.title ?? 'Fehler ohne Titel'}</h2>
        <span className="leise karteKopfRechts" title={zeitpunkt(fehler.created_at)}>
          {relativ(fehler.created_at)}
        </span>
      </div>

      <p className="fehlerText">
        {fehler.message_readable ?? 'Zu diesem Fehler gibt es keine Beschreibung im Klartext.'}
      </p>

      <hr className="trennlinie" />

      <div className="wertePaare">
        <WertPaar name="Automation" wert={fehler.automationName ?? 'nicht zugeordnet'} />
        <WertPaar name="Aufgetreten" wert={zeitpunkt(fehler.created_at)} />
        <WertPaar
          name="Zustand"
          wert={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Zeichen name={fehlerStatusZeichen[fehler.status] ?? 'warnkreis'} groesse={14} />
              {fehlerStatusText[fehler.status] ?? fehler.status}
            </span>
          }
        />
        <WertPaar
          name="Kümmert sich"
          wert={fehler.assigned_to ? profilName(fehler.assigned_to) : 'noch niemand'}
          leise={!fehler.assigned_to}
        />
      </div>

      <div className="knopfReihe" style={{ marginTop: 'var(--raum-4)' }}>
        <button
          type="button"
          className="knopf"
          onClick={uebernehmen}
          disabled={!darfSteuern || laeuft !== null || schonUebernommen}
          title={darfSteuern ? undefined : 'Dafür fehlt dir das Recht zum Steuern.'}
        >
          <Zeichen name="hand" groesse={15} klasse={laeuft === 'uebernehmen' ? 'dreht' : undefined} />
          {schonUebernommen ? `${profilName(fehler.assigned_to)} kümmert sich` : 'Kümmere ich mich drum'}
        </button>
        <button
          type="button"
          className="knopf knopfHaupt"
          onClick={erledigen}
          disabled={!darfSteuern || laeuft !== null}
          title={darfSteuern ? undefined : 'Dafür fehlt dir das Recht zum Steuern.'}
        >
          <Zeichen name="haken" groesse={15} />
          Erledigt
        </button>
        {fehler.automation_id && (
          <button
            type="button"
            className="knopf knopfLeise"
            onClick={() => gehZu(`#/automationen/${fehler.automation_id}`)}
          >
            Zur Automation
            <Zeichen name="pfeilRechts" groesse={14} />
          </button>
        )}
      </div>

      {!darfSteuern && (
        <p className="knopfGrund" style={{ marginTop: 'var(--raum-2)', maxWidth: 'none' }}>
          Du darfst zuschauen, nicht steuern. Amanuel kann dir das Recht geben, Fehler zu übernehmen und abzuhaken.
        </p>
      )}
    </article>
  );
}

export default function Fehler({ gehZu }: { gehZu: (ziel: string) => void }) {
  const { fehler, ersteLadung, laden } = useDaten();
  const [nurSchwere, setNurSchwere] = useState('alle');

  const gefiltert = fehler.filter((eintrag) => nurSchwere === 'alle' || eintrag.severity === nurSchwere);
  const schwer = fehler.filter((e) => e.severity === 'kritisch' || e.severity === 'hoch').length;

  if (ersteLadung && laden) return <SkelettKarten anzahl={3} zeilen={4} />;

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Fehler</h1>
          <p>
            {fehler.length === 0
              ? 'Nichts offen, schön.'
              : `${anzahl(fehler.length)} offen, schlimmste zuerst${
                  schwer > 0 ? `, davon ${anzahl(schwer)} schwer` : ''
                }`}
          </p>
        </div>
        <div className="seitenkopfRechts">
          <select
            value={nurSchwere}
            onChange={(ereignis) => setNurSchwere(ereignis.target.value)}
            style={{ width: 'auto' }}
            aria-label="Schweregrad"
          >
            <option value="alle">Alle Schweregrade</option>
            <option value="kritisch">Nur kritisch</option>
            <option value="hoch">Nur hoch</option>
            <option value="mittel">Nur mittel</option>
            <option value="niedrig">Nur niedrig</option>
          </select>
        </div>
      </div>

      {gefiltert.length === 0 ? (
        <LeererZustand
          titel={fehler.length === 0 ? 'Kein offener Fehler' : 'In dieser Auswahl ist nichts offen'}
          text={
            fehler.length === 0
              ? 'Es liegt nichts an. Wenn eine Automation stolpert, landet der Fehler hier, schlimmster zuerst.'
              : 'Wähle einen anderen Schweregrad, um die übrigen Fehler zu sehen.'
          }
          zeichen={fehler.length === 0 ? 'schild' : 'lupe'}
          aktion={
            fehler.length > 0 ? (
              <button type="button" className="knopf knopfKlein" onClick={() => setNurSchwere('alle')}>
                Alle Fehler zeigen
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="stapel">
          {gefiltert.map((eintrag) => (
            <FehlerKarte key={eintrag.id} fehler={eintrag} gehZu={gehZu} />
          ))}
        </div>
      )}
    </>
  );
}
