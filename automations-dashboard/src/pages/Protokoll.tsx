import { useEffect, useMemo, useState } from 'react';
import { useDaten } from '../lib/data';
import { ladeBefehle, ladeProtokoll } from '../lib/queries';
import { text as feldText, type Zeile } from '../lib/fields';
import { anzahl, relativ, zeitpunkt } from '../lib/format';
import { aktionText, befehlStatusText, befehlStatusTon } from '../lib/labels';
import { Etikett, LeererZustand, Meldung } from '../components/Bausteine';
import type { Befehl } from '../lib/types';

function Zugangszeile({ zeile, name }: { zeile: Zeile; name: (id: string | null) => string }) {
  const zeitfeld = feldText(zeile, ['created_at', 'erstellt_am', 'zeitpunkt', 'timestamp', 'inserted_at', 'at']);
  const aktion = feldText(zeile, ['action', 'aktion', 'ereignis', 'event']) ?? 'Änderung';
  const akteur = feldText(zeile, ['actor_id', 'user_id', 'akteur_id', 'changed_by']);
  const ziel = feldText(zeile, ['target_id', 'target_user_id', 'ziel_id', 'profile_id']);

  return (
    <tr>
      <td title={zeitpunkt(zeitfeld)}>{relativ(zeitfeld)}</td>
      <td>{name(akteur)}</td>
      <td>{aktion}</td>
      <td>{ziel ? name(ziel) : 'nicht angegeben'}</td>
    </tr>
  );
}

export default function Protokoll() {
  const { profilName, automationen } = useDaten();
  const [befehle, setBefehle] = useState<Befehl[] | null>(null);
  const [zugaenge, setZugaenge] = useState<Zeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;

    (async () => {
      try {
        const [b, z] = await Promise.all([ladeBefehle(100), ladeProtokoll(50)]);
        if (abgebrochen) return;
        setBefehle(b);
        setZugaenge(
          [...z].sort((a, c) => {
            const zeitA = new Date(feldText(a, ['created_at', 'erstellt_am', 'zeitpunkt', 'timestamp', 'inserted_at']) ?? 0).getTime();
            const zeitC = new Date(feldText(c, ['created_at', 'erstellt_am', 'zeitpunkt', 'timestamp', 'inserted_at']) ?? 0).getTime();
            return zeitC - zeitA;
          }),
        );
      } catch (problem) {
        if (!abgebrochen) {
          setBefehle([]);
          setFehler(problem instanceof Error ? problem.message : 'Das Protokoll konnte nicht geladen werden.');
        }
      }
    })();

    return () => {
      abgebrochen = true;
    };
  }, []);

  const namen = useMemo(
    () => new Map(automationen.map((eintrag) => [eintrag.id, eintrag.name])),
    [automationen],
  );

  return (
    <>
      <div className="karteKopf">
        <h1>Protokoll</h1>
        <span className="leise">Wer hat was gesteuert. Nicht zur Kontrolle, sondern damit später klar ist, woran es lag.</span>
      </div>

      {fehler && <Meldung ton="rot">{fehler}</Meldung>}

      <section className="karte">
        <div className="karteKopf">
          <h2>Steuerung</h2>
          <span className="leise">{befehle ? `${anzahl(befehle.length)} Einträge` : 'wird geladen'}</span>
        </div>

        {befehle === null ? (
          <p className="laden">Das Protokoll wird geladen.</p>
        ) : befehle.length === 0 ? (
          <LeererZustand
            titel="Noch nichts gesteuert"
            text="Sobald jemand eine Automation anhält oder von Hand startet, steht der Vorgang hier."
          />
        ) : (
          <div className="tabelleHuelle">
            <table>
              <thead>
                <tr>
                  <th>Wann</th>
                  <th>Wer</th>
                  <th>Was</th>
                  <th>Automation</th>
                  <th>Stand</th>
                </tr>
              </thead>
              <tbody>
                {befehle.map((befehl) => (
                  <tr key={befehl.id}>
                    <td title={zeitpunkt(befehl.requested_at)}>{relativ(befehl.requested_at)}</td>
                    <td>{befehl.requested_by ? profilName(befehl.requested_by) : 'automatisch'}</td>
                    <td>{aktionText[befehl.action] ?? befehl.action}</td>
                    <td>{namen.get(befehl.automation_id ?? '') ?? 'nicht zugeordnet'}</td>
                    <td>
                      <Etikett
                        ton={befehlStatusTon[befehl.status] ?? 'leise'}
                        text={befehlStatusText[befehl.status] ?? befehl.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="karte">
        <div className="karteKopf">
          <h2>Zugänge</h2>
          <span className="leise">wer wem Zugang gegeben oder entzogen hat</span>
        </div>

        {zugaenge.length === 0 ? (
          <LeererZustand
            titel="Noch keine Änderung an Zugängen"
            text="Wenn Amanuel jemandem Rechte gibt oder entzieht, steht es hier."
          />
        ) : (
          <div className="tabelleHuelle">
            <table>
              <thead>
                <tr>
                  <th>Wann</th>
                  <th>Wer</th>
                  <th>Was</th>
                  <th>Bei wem</th>
                </tr>
              </thead>
              <tbody>
                {zugaenge.map((zeile, index) => (
                  <Zugangszeile key={String(zeile.id ?? index)} zeile={zeile} name={(id) => (id ? profilName(id) : 'unbekannt')} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
