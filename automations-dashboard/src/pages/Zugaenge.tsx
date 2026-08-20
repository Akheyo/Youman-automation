import { useState } from 'react';
import { useAnmeldung } from '../lib/auth';
import { useDaten } from '../lib/data';
import { protokollSchreiben, rolleSetzen, zugangSetzen } from '../lib/queries';
import { useHinweise } from '../components/Hinweise';
import { Etikett, LeererZustand, Meldung, SkelettKarten } from '../components/Bausteine';
import Zeichen from '../components/Icons';
import { anzahl, namenKurz } from '../lib/format';
import { rolleErklaerung, rolleText } from '../lib/labels';
import type { Profil, Rolle } from '../lib/types';

const rollen: Rolle[] = ['viewer', 'operator', 'admin'];

function Person({ profil }: { profil: Profil }) {
  const { session, profil: eigenes, profilNeuLaden } = useAnmeldung();
  const { neuLaden } = useDaten();
  const { zeigen } = useHinweise();
  const [laeuft, setLaeuft] = useState(false);

  const selbst = profil.id === eigenes?.id;

  const rolleAendern = async (neu: Rolle) => {
    if (neu === profil.role || !session?.user) return;
    setLaeuft(true);
    try {
      await rolleSetzen(profil.id, neu);
      const notiert = await protokollSchreiben({
        akteurId: session.user.id,
        zielId: profil.id,
        aktion: `rolle_geaendert_zu_${neu}`,
        vorher: profil.role,
        nachher: neu,
      });
      zeigen(
        notiert
          ? `${namenKurz(profil.full_name, profil.email)} darf jetzt: ${rolleText[neu]}.`
          : `${namenKurz(profil.full_name, profil.email)} darf jetzt: ${rolleText[neu]}. Der Protokolleintrag ist nicht geschrieben worden.`,
        notiert ? 'blau' : 'rot',
      );
      await neuLaden();
      if (selbst) await profilNeuLaden();
    } catch (problem) {
      zeigen(problem instanceof Error ? problem.message : 'Die Änderung hat nicht geklappt.', 'rot');
    } finally {
      setLaeuft(false);
    }
  };

  const zugangUmschalten = async () => {
    if (!session?.user) return;
    const neu = !profil.active;
    setLaeuft(true);
    try {
      await zugangSetzen(profil.id, neu);
      const notiert = await protokollSchreiben({
        akteurId: session.user.id,
        zielId: profil.id,
        aktion: neu ? 'zugang_gegeben' : 'zugang_entzogen',
        vorher: profil.active,
        nachher: neu,
      });
      zeigen(
        `${namenKurz(profil.full_name, profil.email)} ${neu ? 'hat wieder Zugang' : 'hat keinen Zugang mehr'}.` +
          (notiert ? '' : ' Der Protokolleintrag ist nicht geschrieben worden.'),
        notiert ? 'blau' : 'rot',
      );
      await neuLaden();
      if (selbst) await profilNeuLaden();
    } catch (problem) {
      zeigen(problem instanceof Error ? problem.message : 'Die Änderung hat nicht geklappt.', 'rot');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <tr>
      <td data-name="Person">
        <div style={{ fontWeight: 600 }}>{namenKurz(profil.full_name, profil.email)}</div>
        <div className="leise klein">{profil.email ?? 'keine E-Mail hinterlegt'}</div>
      </td>
      <td data-name="Darf">
        <select
          value={profil.role}
          onChange={(ereignis) => void rolleAendern(ereignis.target.value as Rolle)}
          disabled={laeuft}
          aria-label={`Rechte von ${namenKurz(profil.full_name, profil.email)}`}
        >
          {rollen.map((rolle) => (
            <option key={rolle} value={rolle}>
              {rolleText[rolle]}
            </option>
          ))}
        </select>
        <div className="leise klein" style={{ marginTop: 4 }}>
          {rolleErklaerung[profil.role]}
        </div>
      </td>
      <td data-name="Zustand">
        <Etikett
          ton={profil.active ? 'blau' : 'leise'}
          text={profil.active ? 'Zugang offen' : 'Zugang gesperrt'}
          zeichen={profil.active ? 'haken' : 'stopp'}
        />
      </td>
      <td data-name="Zugang">
        <button
          type="button"
          className={`knopf ${profil.active ? 'knopfWarnung' : 'knopfHaupt'}`}
          onClick={() => void zugangUmschalten()}
          disabled={laeuft || selbst}
          title={selbst ? 'Den eigenen Zugang kannst du dir nicht selbst entziehen.' : undefined}
        >
          <Zeichen name={profil.active ? 'stopp' : 'haken'} groesse={15} klasse={laeuft ? 'dreht' : undefined} />
          {profil.active ? 'Zugang entziehen' : 'Zugang geben'}
        </button>
      </td>
    </tr>
  );
}

export default function Zugaenge() {
  const { darfVerwalten } = useAnmeldung();
  const { profile, ersteLadung, laden } = useDaten();

  if (!darfVerwalten) {
    return (
      <Meldung ton="blau">
        Zugänge vergibt und entzieht nur Amanuel Kheyo. Wenn jemand Zugang braucht, sag ihm Bescheid.
      </Meldung>
    );
  }

  if (ersteLadung && laden) return <SkelettKarten anzahl={3} zeilen={2} />;

  const offen = profile.filter((eintrag) => eintrag.active).length;

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Zugänge</h1>
          <p>
            {anzahl(profile.length)} Personen, davon {anzahl(offen)} mit offenem Zugang
          </p>
        </div>
      </div>

      <Meldung ton="blau">
        Zuschauen heißt alles sehen, nichts steuern. Steuern heißt zusätzlich anhalten, starten und Fehler abhaken.
        Alles heißt zusätzlich Zugänge vergeben und entziehen.
      </Meldung>

      {profile.length === 0 ? (
        <LeererZustand
          titel="Noch niemand eingetragen"
          text="Sobald jemand ein Konto hat, erscheint die Person hier und du kannst ihr Rechte geben."
        />
      ) : (
        <section className="karte">
          <div className="tabelleHuelle tabelleKarten">
            <table>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Darf</th>
                  <th scope="col">Zustand</th>
                  <th scope="col">Zugang</th>
                </tr>
              </thead>
              <tbody>
                {profile.map((profil) => (
                  <Person key={profil.id} profil={profil} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
