import { useEffect, useMemo, useState } from 'react';
import { useDaten } from '../lib/data';
import { ladeBefehle, ladeProtokoll } from '../lib/queries';
import { text as feldText, type Zeile } from '../lib/fields';
import { anzahl, relativ, zeitpunkt } from '../lib/format';
import {
  aktionText,
  befehlStatusText,
  befehlStatusTon,
  befehlStatusZeichen,
  protokollAktionText,
} from '../lib/labels';
import { Etikett, LeererZustand, Meldung, SkelettKarten } from '../components/Bausteine';
import type { Befehl } from '../lib/types';

const zeitFelder = ['created_at', 'erstellt_am', 'zeitpunkt', 'timestamp', 'inserted_at', 'at'];

function zeitVon(zeile: Zeile): number {
  const wert = feldText(zeile, zeitFelder);
  const zeit = wert ? new Date(wert).getTime() : 0;
  return Number.isFinite(zeit) ? zeit : 0;
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
        setZugaenge([...z].sort((a, c) => zeitVon(c) - zeitVon(a)));
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
      <div className="seitenkopf">
        <div>
          <h1>Protokoll</h1>
          <p>
            Wer hat was gesteuert. Nicht zur Kontrolle, sondern damit später klar ist, woran es lag.
          </p>
        </div>
      </div>

      {fehler && <Meldung ton="rot">{fehler}</Meldung>}

      <section className="karte">
        <div className="karteKopf">
          <h2>Steuerung</h2>
          <span className="leise karteKopfRechts">
            {befehle ? `${anzahl(befehle.length)} Einträge, neueste zuerst` : 'wird geladen'}
          </span>
        </div>

        {befehle === null ? (
          <SkelettKarten anzahl={3} zeilen={2} />
        ) : befehle.length === 0 ? (
          <LeererZustand
            titel="Noch nichts gesteuert"
            text="Sobald jemand eine Automation anhält oder von Hand startet, steht der Vorgang hier."
            zeichen="uhr"
          />
        ) : (
          <div className="tabelleHuelle tabelleKarten">
            <table>
              <thead>
                <tr>
                  <th scope="col">Wann</th>
                  <th scope="col">Wer</th>
                  <th scope="col">Was</th>
                  <th scope="col">Automation</th>
                  <th scope="col">Stand</th>
                </tr>
              </thead>
              <tbody>
                {befehle.map((befehl) => (
                  <tr key={befehl.id}>
                    <td data-name="Wann" title={zeitpunkt(befehl.requested_at)}>
                      {relativ(befehl.requested_at)}
                    </td>
                    <td data-name="Wer">{befehl.requested_by ? profilName(befehl.requested_by) : 'automatisch'}</td>
                    <td data-name="Was">{aktionText[befehl.action] ?? befehl.action}</td>
                    <td data-name="Automation">{namen.get(befehl.automation_id ?? '') ?? 'nicht zugeordnet'}</td>
                    <td data-name="Stand">
                      <Etikett
                        ton={befehlStatusTon[befehl.status] ?? 'leise'}
                        text={befehlStatusText[befehl.status] ?? befehl.status}
                        zeichen={befehlStatusZeichen[befehl.status] ?? 'auskunft'}
                        dreht={befehl.status === 'accepted'}
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
          <span className="leise karteKopfRechts">wer wem Zugang gegeben oder entzogen hat</span>
        </div>

        {zugaenge.length === 0 ? (
          <LeererZustand
            titel="Noch keine Änderung an Zugängen"
            text="Wenn Amanuel jemandem Rechte gibt oder entzieht, steht es hier."
            zeichen="menschen"
          />
        ) : (
          <div className="tabelleHuelle tabelleKarten">
            <table>
              <thead>
                <tr>
                  <th scope="col">Wann</th>
                  <th scope="col">Wer</th>
                  <th scope="col">Was</th>
                  <th scope="col">Bei wem</th>
                </tr>
              </thead>
              <tbody>
                {zugaenge.map((zeile, index) => {
                  const zeit = feldText(zeile, zeitFelder);
                  const akteur = feldText(zeile, ['actor_id', 'user_id', 'akteur_id', 'changed_by']);
                  const ziel = feldText(zeile, ['target_id', 'target_user_id', 'ziel_id', 'profile_id']);
                  return (
                    <tr key={String(zeile.id ?? index)}>
                      <td data-name="Wann" title={zeitpunkt(zeit)}>
                        {relativ(zeit)}
                      </td>
                      <td data-name="Wer">{akteur ? profilName(akteur) : 'unbekannt'}</td>
                      <td data-name="Was">
                        {protokollAktionText(feldText(zeile, ['action', 'aktion', 'ereignis', 'event']))}
                      </td>
                      <td data-name="Bei wem">{ziel ? profilName(ziel) : 'nicht angegeben'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
