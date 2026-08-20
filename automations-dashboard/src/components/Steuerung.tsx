import { useState } from 'react';
import { useAnmeldung } from '../lib/auth';
import { useDaten } from '../lib/data';
import { useHinweise } from './Hinweise';
import { befehlSchreiben } from '../lib/queries';
import { aktionText, aktionWartet, aktionZeichen } from '../lib/labels';
import Zeichen from './Icons';
import type { AutomationStatus, BefehlAktion, Durchlauf } from '../lib/types';

interface KnopfEigenschaften {
  automationId: string;
  aktion: BefehlAktion;
  runId?: string | null;
  haupt?: boolean;
  warnung?: boolean;
  klein?: boolean;
  /** Der Hinweis für Zuschauer steht nur einmal je Gruppe, nicht an jedem Knopf. */
  ohneGrund?: boolean;
}

/**
 * Ein Klick schreibt eine Zeile in control_commands. Die Automationen selbst
 * sind noch nicht angebunden, deshalb zeigt die Oberfläche den Auftrag als
 * angefordert, bis ein Worker ihn abarbeitet.
 */
export function Steuerknopf({
  automationId,
  aktion,
  runId,
  haupt,
  warnung,
  klein,
  ohneGrund,
}: KnopfEigenschaften) {
  const { darfSteuern, session } = useAnmeldung();
  const { offeneBefehle, neuLaden } = useDaten();
  const { zeigen } = useHinweise();
  const [laeuft, setLaeuft] = useState(false);

  const wartet = offeneBefehle.some(
    (befehl) =>
      befehl.action === aktion &&
      befehl.automation_id === automationId &&
      (runId ? befehl.run_id === runId : true),
  );

  const klick = async () => {
    if (!session?.user) return;
    setLaeuft(true);
    try {
      await befehlSchreiben({ automationId, aktion, runId: runId ?? null, benutzerId: session.user.id });
      zeigen(`${aktionText[aktion]}: Auftrag ist eingetragen und wird gleich ausgeführt.`);
      await neuLaden();
    } catch (fehler) {
      zeigen(fehler instanceof Error ? fehler.message : 'Der Auftrag konnte nicht eingetragen werden.', 'rot');
    } finally {
      setLaeuft(false);
    }
  };

  const klassen = ['knopf'];
  if (haupt) klassen.push('knopfHaupt');
  if (warnung) klassen.push('knopfWarnung');
  if (klein) klassen.push('knopfKlein');

  return (
    <span className="knopfHuelle">
      <button
        type="button"
        className={klassen.join(' ')}
        onClick={klick}
        disabled={!darfSteuern || laeuft || wartet}
        title={darfSteuern ? undefined : 'Dafür fehlt dir das Recht zum Steuern.'}
      >
        <Zeichen
          name={laeuft || wartet ? 'kreisel' : aktionZeichen[aktion]}
          groesse={klein ? 14 : 15}
          klasse={laeuft ? 'dreht' : undefined}
        />
        {wartet ? aktionWartet[aktion] : laeuft ? 'Einen Moment' : aktionText[aktion]}
      </button>
      {!darfSteuern && !ohneGrund && (
        <span className="knopfGrund">Du darfst zuschauen, nicht steuern. Amanuel kann dir das Recht geben.</span>
      )}
    </span>
  );
}

export function AutomationSteuerung({ id, status }: { id: string; status: AutomationStatus }) {
  const { darfSteuern } = useAnmeldung();
  const laeuft = status === 'running';

  return (
    <div>
      <div className="knopfReihe">
        <Steuerknopf automationId={id} aktion="run_now" haupt ohneGrund />
        {laeuft ? (
          <Steuerknopf automationId={id} aktion="stop" ohneGrund />
        ) : (
          <Steuerknopf automationId={id} aktion="start" ohneGrund />
        )}
      </div>
      {!darfSteuern && (
        <p className="knopfGrund" style={{ maxWidth: 'none', marginTop: 'var(--raum-2)' }}>
          Du darfst zuschauen, nicht steuern. Wenn du das brauchst, kann Amanuel dir das Recht geben.
        </p>
      )}
    </div>
  );
}

export function DurchlaufSteuerung({ durchlauf }: { durchlauf: Durchlauf }) {
  if (durchlauf.status === 'running') {
    return <Steuerknopf automationId={durchlauf.automation_id} aktion="cancel" runId={durchlauf.id} warnung klein ohneGrund />;
  }
  if (durchlauf.status === 'error') {
    return <Steuerknopf automationId={durchlauf.automation_id} aktion="retry" runId={durchlauf.id} klein ohneGrund />;
  }
  return null;
}
