import { anzahl, dauer, relativ, seit, uhrzeit, zeitpunkt } from '../lib/format';
import { ausloeser, durchlaufText, durchlaufTon } from '../lib/labels';
import { useDaten } from '../lib/data';
import type { Durchlauf } from '../lib/types';
import { Etikett, LeererZustand } from './Bausteine';
import { DurchlaufSteuerung } from './Steuerung';

function Menge({ durchlauf }: { durchlauf: Durchlauf }) {
  const gesamt = durchlauf.items_total;
  if (gesamt === null || gesamt === undefined) return null;
  const fehlgeschlagen = durchlauf.items_failed ?? 0;
  const erfolgreich = durchlauf.items_success ?? Math.max(0, gesamt - fehlgeschlagen);
  return (
    <span className="durchlaufZahlen">
      {anzahl(gesamt)} verarbeitet, davon {anzahl(erfolgreich)} in Ordnung
      {fehlgeschlagen > 0 ? ` und ${anzahl(fehlgeschlagen)} nicht` : ''}
    </span>
  );
}

export function DurchlaufZeile({ durchlauf, mitName }: { durchlauf: Durchlauf; mitName?: string | null }) {
  const { profilName } = useDaten();
  const laeuft = durchlauf.status === 'running';

  return (
    <article className="durchlauf">
      <div className="durchlaufKopf">
        <Etikett ton={durchlaufTon[durchlauf.status]} text={durchlaufText[durchlauf.status]} pulst={laeuft} />
        {mitName && <span className="durchlaufZeit">{mitName}</span>}
        <span className="durchlaufZeit" title={zeitpunkt(durchlauf.started_at)}>
          {laeuft ? `Start um ${uhrzeit(durchlauf.started_at)}` : `Start ${relativ(durchlauf.started_at)}`}
        </span>
        <span className="leise">
          {laeuft ? `läuft seit ${seit(durchlauf.started_at)}` : `Dauer ${dauer(durchlauf.duration_seconds)}`}
        </span>
        <Menge durchlauf={durchlauf} />
      </div>

      <div className="leise">
        {ausloeser(durchlauf.trigger_type)}
        {durchlauf.triggered_by ? ` von ${profilName(durchlauf.triggered_by)}` : ''}
      </div>

      {durchlauf.status === 'error' && (
        <div className="klartext">
          {durchlauf.error_message_readable ??
            'Warum es schiefgegangen ist, steht nicht im Klartext dabei. Die technische Meldung hilft weiter.'}
        </div>
      )}

      {durchlauf.error_message_raw && (
        <details className="technisch">
          <summary>Technische Meldung anzeigen</summary>
          <pre className="roh">{durchlauf.error_message_raw}</pre>
        </details>
      )}

      <div className="knopfReihe">
        <DurchlaufSteuerung durchlauf={durchlauf} />
        {durchlauf.raw_log_url && (
          <a className="knopf knopfLeise" href={durchlauf.raw_log_url} target="_blank" rel="noreferrer">
            Vollständiges Protokoll öffnen
          </a>
        )}
      </div>
    </article>
  );
}

export function DurchlaufListe({
  durchlaeufe,
  laden,
  leerTitel = 'Noch nichts gelaufen',
  leerText = 'Mit „Jetzt sofort starten" kannst du den ersten Durchlauf anstoßen.',
  namen,
}: {
  durchlaeufe: Durchlauf[];
  laden?: boolean;
  leerTitel?: string;
  leerText?: string;
  namen?: Map<string, string>;
}) {
  if (laden && durchlaeufe.length === 0) return <p className="laden">Durchläufe werden geladen.</p>;
  if (durchlaeufe.length === 0) return <LeererZustand titel={leerTitel} text={leerText} />;

  return (
    <div className="liste">
      {durchlaeufe.map((durchlauf) => (
        <DurchlaufZeile
          key={durchlauf.id}
          durchlauf={durchlauf}
          mitName={namen?.get(durchlauf.automation_id) ?? null}
        />
      ))}
    </div>
  );
}
