import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDaten } from '../lib/data';
import { ladeDurchlaeufe } from '../lib/queries';
import { anzahl, namenKurz, prozent, relativ, zeitpunkt, zeitplanText } from '../lib/format';
import { automationText, automationTon } from '../lib/labels';
import { Etikett, LeererZustand, Meldung, Pfeil, WertPaar } from '../components/Bausteine';
import { DurchlaufListe } from '../components/Durchlaeufe';
import { AutomationSteuerung } from '../components/Steuerung';
import { useHinweise } from '../components/Hinweise';
import type { AutomationUebersicht, Durchlauf } from '../lib/types';

function zuverlaessigkeitTon(wert: number | null) {
  if (wert === null) return 'leise' as const;
  if (wert >= 95) return 'blau' as const;
  if (wert >= 80) return 'gelb' as const;
  return 'rot' as const;
}

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

  const zustaendig =
    automation.zustaendigName ??
    namenKurz(
      profile.find((eintrag) => eintrag.id === automation.zustaendigId)?.full_name,
      profile.find((eintrag) => eintrag.id === automation.zustaendigId)?.email,
    );

  const wartend = offeneBefehle.filter((befehl) => befehl.automation_id === automation.id);

  return (
    <div className="zeile" id={`automation-${automation.id}`}>
      <button type="button" className="zeileKopf" onClick={umschalten} aria-expanded={offen}>
        <Etikett
          ton={automationTon[automation.status]}
          text={automationText[automation.status]}
          pulst={automation.status === 'running'}
        />
        <span className="zeileTitel">
          <span className="zeileName">{automation.name}</span>
          <span className="zeileUnter">
            {automation.category ? `${automation.category}, ` : ''}
            zuletzt gelaufen {relativ(automation.lastRunAt)}
            {automation.offeneFehler > 0
              ? `, ${anzahl(automation.offeneFehler)} ${automation.offeneFehler === 1 ? 'offener Fehler' : 'offene Fehler'}`
              : ''}
          </span>
        </span>
        <span className="zeileRechts">
          <Etikett
            ton={zuverlaessigkeitTon(automation.zuverlaessigkeit14d)}
            text={
              automation.zuverlaessigkeit14d === null
                ? 'noch keine Angabe'
                : `${prozent(automation.zuverlaessigkeit14d)} in 14 Tagen`
            }
          />
          <Pfeil offen={offen} />
        </span>
      </button>

      {offen && (
        <div className="zeileInhalt">
          <div className="wertePaare">
            <WertPaar name="Zuletzt gelaufen" wert={`${relativ(automation.lastRunAt)} (${zeitpunkt(automation.lastRunAt)})`} />
            <WertPaar name="Das nächste Mal dran" wert={`${relativ(automation.nextRunAt)} (${zeitpunkt(automation.nextRunAt)})`} />
            <WertPaar name="Zeitplan" wert={zeitplanText(automation.scheduleCron)} />
            <WertPaar
              name="Zuverlässigkeit 14 Tage"
              wert={automation.zuverlaessigkeit14d === null ? 'noch keine Angabe' : prozent(automation.zuverlaessigkeit14d)}
            />
            <WertPaar name="Zuständig" wert={zustaendig} />
            <WertPaar name="Offene Fehler" wert={anzahl(automation.offeneFehler)} />
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
              <button type="button" className="knopf knopfLeise" onClick={() => void durchlaeufeLaden()} disabled={laden}>
                Neu laden
              </button>
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

  useEffect(() => {
    if (!offenId) return;
    setOffen(offenId);
    const ziel = document.getElementById(`automation-${offenId}`);
    if (ziel) ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [offenId, automationen]);

  const kategorien = useMemo(() => {
    const gefunden = new Set<string>();
    automationen.forEach((eintrag) => {
      if (eintrag.category) gefunden.add(eintrag.category);
    });
    return [...gefunden].sort((a, b) => a.localeCompare(b, 'de'));
  }, [automationen]);

  const gefiltert = automationen.filter((eintrag) => {
    const passtKategorie = kategorie === 'alle' || eintrag.category === kategorie;
    const suchtext = suche.trim().toLowerCase();
    const passtSuche =
      !suchtext ||
      eintrag.name.toLowerCase().includes(suchtext) ||
      (eintrag.category ?? '').toLowerCase().includes(suchtext);
    return passtKategorie && passtSuche;
  });

  if (ersteLadung && laden) return <p className="laden">Die Automationen werden geladen.</p>;

  return (
    <>
      <div className="karteKopf">
        <h1>Automationen</h1>
        <span className="leise">
          {anzahl(automationen.length)} insgesamt, {anzahl(automationen.filter((a) => a.status === 'running').length)} laufen
        </span>
      </div>

      <div className="werkzeugleiste">
        <input
          type="search"
          className="wachsen"
          value={suche}
          placeholder="Nach Namen suchen"
          onChange={(ereignis) => setSuche(ereignis.target.value)}
        />
        <select value={kategorie} onChange={(ereignis) => setKategorie(ereignis.target.value)} style={{ width: 'auto' }}>
          <option value="alle">Alle Bereiche</option>
          {kategorien.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {gefiltert.length === 0 ? (
        <LeererZustand
          titel={automationen.length === 0 ? 'Noch keine Automation eingetragen' : 'Nichts gefunden'}
          text={
            automationen.length === 0
              ? 'Sobald die erste Automation in der Datenbank steht, siehst du sie hier.'
              : 'Ändere die Suche oder wähle einen anderen Bereich.'
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
