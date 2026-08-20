import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDaten } from '../lib/data';
import { ladeDurchlaeufe } from '../lib/queries';
import { anzahl, namenKurz, prozent, relativ, zeitpunkt, zeitplanText } from '../lib/format';
import { automationText, automationTon, automationZeichen } from '../lib/labels';
import { Etikett, LeererZustand, Meldung, Pfeil, QuoteBalken, SkelettKarten, WertPaar } from '../components/Bausteine';
import Zeichen from '../components/Icons';
import { DurchlaufListe } from '../components/Durchlaeufe';
import { AutomationSteuerung } from '../components/Steuerung';
import { useHinweise } from '../components/Hinweise';
import type { AutomationStatus, AutomationUebersicht, Durchlauf } from '../lib/types';

function Aufklapper({
  automation,
  offen,
  umschalten,
}: {
  automation: AutomationUebersicht;
  offen: boolean;
  umschalten: () => void;
}) {
  const { profile, offeneBefehle } = useDaten();
  const { zeigen } = useHinweise();
  const [durchlaeufe, setDurchlaeufe] = useState<Durchlauf[] | null>(null);
  const [laden, setLaden] = useState(false);

  const durchlaeufeLaden = useCallback(async () => {
    setLaden(true);
    try {
      setDurchlaeufe(await ladeDurchlaeufe(automation.id, 15));
    } catch (fehler) {
      zeigen(fehler instanceof Error ? fehler.message : 'Die Durchläufe konnten nicht geladen werden.', 'rot');
      setDurchlaeufe([]);
    } finally {
      setLaden(false);
    }
  }, [automation.id, zeigen]);

  useEffect(() => {
    if (offen && durchlaeufe === null && !laden) void durchlaeufeLaden();
  }, [offen, durchlaeufe, laden, durchlaeufeLaden]);

  const person = profile.find((eintrag) => eintrag.id === automation.zustaendigId);
  const zustaendig = automation.zustaendigName ?? namenKurz(person?.full_name, person?.email);
  const wartend = offeneBefehle.filter((befehl) => befehl.automation_id === automation.id);

  return (
    <div className={`zeile ${offen ? 'zeileOffen' : ''}`} id={`automation-${automation.id}`}>
      <button type="button" className="zeileKopf" onClick={umschalten} aria-expanded={offen}>
        <Etikett
          ton={automationTon[automation.status]}
          text={automationText[automation.status]}
          zeichen={automationZeichen[automation.status]}
          dreht={automation.status === 'running'}
        />
        <span className="zeileTitel">
          <span className="zeileName">{automation.name}</span>
          <span className="zeileUnter">
            {automation.category ? `${automation.category}, ` : ''}
            zuletzt gelaufen {relativ(automation.lastRunAt)}
            {automation.offeneFehler > 0
              ? `, ${anzahl(automation.offeneFehler)} ${
                  automation.offeneFehler === 1 ? 'offener Fehler' : 'offene Fehler'
                }`
              : ''}
          </span>
        </span>
        <span className="zeileRechts">
          <span className="leise klein" style={{ whiteSpace: 'nowrap' }}>
            {automation.zuverlaessigkeit14d === null ? 'keine Angabe' : prozent(automation.zuverlaessigkeit14d)}
          </span>
          <QuoteBalken quote={automation.zuverlaessigkeit14d} />
          <Pfeil offen={offen} />
        </span>
      </button>

      {offen && (
        <div className="zeileInhalt">
          <div className="wertePaare">
            <WertPaar
              name="Zuletzt gelaufen"
              wert={
                <>
                  {relativ(automation.lastRunAt)}
                  <span className="leise klein"> {zeitpunkt(automation.lastRunAt)}</span>
                </>
              }
            />
            <WertPaar
              name="Das nächste Mal dran"
              wert={
                <>
                  {relativ(automation.nextRunAt)}
                  <span className="leise klein"> {zeitpunkt(automation.nextRunAt)}</span>
                </>
              }
            />
            <WertPaar name="Zeitplan" wert={zeitplanText(automation.scheduleCron)} />
            <WertPaar
              name="Zuverlässigkeit 14 Tage"
              wert={
                automation.zuverlaessigkeit14d === null
                  ? 'noch keine Angabe'
                  : prozent(automation.zuverlaessigkeit14d)
              }
            />
            <WertPaar name="Zuständig" wert={zustaendig} />
            <WertPaar
              name="Offene Fehler"
              wert={anzahl(automation.offeneFehler)}
              leise={automation.offeneFehler === 0}
            />
          </div>

          <AutomationSteuerung id={automation.id} status={automation.status} />

          {wartend.length > 0 && (
            <Meldung ton="blau">
              {wartend.length === 1
                ? 'Ein Auftrag steht in der Warteschlange und wird gleich ausgeführt.'
                : `${anzahl(wartend.length)} Aufträge stehen in der Warteschlange und werden gleich ausgeführt.`}
            </Meldung>
          )}

          <div>
            <div className="karteKopf">
              <h3>Die letzten Durchläufe</h3>
              <div className="karteKopfRechts">
                <button
                  type="button"
                  className="knopf knopfLeise knopfKlein"
                  onClick={() => void durchlaeufeLaden()}
                  disabled={laden}
                >
                  <Zeichen name="neuLaden" groesse={14} klasse={laden ? 'dreht' : undefined} />
                  Neu laden
                </button>
              </div>
            </div>
            <DurchlaufListe durchlaeufe={durchlaeufe ?? []} laden={laden || durchlaeufe === null} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Automationen({ offenId }: { offenId?: string | null }) {
  const { automationen, ersteLadung, laden } = useDaten();
  const [offen, setOffen] = useState<string | null>(offenId ?? null);
  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState('alle');
  const [zustand, setZustand] = useState<'alle' | AutomationStatus>('alle');

  useEffect(() => {
    if (!offenId) return;
    setOffen(offenId);
    const ziel = document.getElementById(`automation-${offenId}`);
    if (ziel) ziel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [offenId, automationen]);

  const kategorien = useMemo(() => {
    const gefunden = new Set<string>();
    automationen.forEach((eintrag) => {
      if (eintrag.category) gefunden.add(eintrag.category);
    });
    return [...gefunden].sort((a, b) => a.localeCompare(b, 'de'));
  }, [automationen]);

  const gefiltert = automationen.filter((eintrag) => {
    const suchtext = suche.trim().toLowerCase();
    const passtSuche =
      !suchtext ||
      eintrag.name.toLowerCase().includes(suchtext) ||
      (eintrag.category ?? '').toLowerCase().includes(suchtext);
    return (
      passtSuche &&
      (kategorie === 'alle' || eintrag.category === kategorie) &&
      (zustand === 'alle' || eintrag.status === zustand)
    );
  });

  const laufend = automationen.filter((eintrag) => eintrag.status === 'running').length;

  if (ersteLadung && laden) return <SkelettKarten anzahl={4} zeilen={2} />;

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Automationen</h1>
          <p>
            {anzahl(automationen.length)} eingetragen, {anzahl(laufend)} {laufend === 1 ? 'läuft' : 'laufen'} gerade
          </p>
        </div>
      </div>

      <div className="werkzeugleiste">
        <div className="suchfeld">
          <span className="suchfeldZeichen">
            <Zeichen name="lupe" groesse={16} />
          </span>
          <input
            type="search"
            value={suche}
            placeholder="Nach Namen suchen"
            aria-label="Automationen nach Namen durchsuchen"
            onChange={(ereignis) => setSuche(ereignis.target.value)}
          />
        </div>
        <select
          value={kategorie}
          onChange={(ereignis) => setKategorie(ereignis.target.value)}
          style={{ width: 'auto' }}
          aria-label="Bereich"
        >
          <option value="alle">Alle Bereiche</option>
          {kategorien.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={zustand}
          onChange={(ereignis) => setZustand(ereignis.target.value as 'alle' | AutomationStatus)}
          style={{ width: 'auto' }}
          aria-label="Zustand"
        >
          <option value="alle">Jeder Zustand</option>
          <option value="running">Läuft</option>
          <option value="paused">Pausiert</option>
          <option value="stopped">Angehalten</option>
          <option value="error">Hat ein Problem</option>
        </select>
      </div>

      {gefiltert.length === 0 ? (
        <LeererZustand
          titel={automationen.length === 0 ? 'Noch keine Automation eingetragen' : 'Nichts gefunden'}
          text={
            automationen.length === 0
              ? 'Sobald die erste Automation in der Datenbank steht, siehst du sie hier mit Zustand, Zeitplan und Durchläufen.'
              : 'Ändere die Suche, den Bereich oder den Zustand.'
          }
          zeichen={automationen.length === 0 ? 'postfach' : 'lupe'}
          aktion={
            automationen.length > 0 ? (
              <button
                type="button"
                className="knopf knopfKlein"
                onClick={() => {
                  setSuche('');
                  setKategorie('alle');
                  setZustand('alle');
                }}
              >
                Auswahl zurücksetzen
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="liste">
          {gefiltert.map((automation) => (
            <Aufklapper
              key={automation.id}
              automation={automation}
              offen={offen === automation.id}
              umschalten={() => setOffen(offen === automation.id ? null : automation.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
