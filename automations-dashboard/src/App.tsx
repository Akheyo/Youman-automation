import { useEffect, useMemo, useState } from 'react';
import { useAnmeldung } from './lib/auth';
import { DatenProvider, useDaten } from './lib/data';
import { appUmgebung, supabaseEingerichtet } from './lib/supabase';
import Anmeldung from './pages/Anmeldung';
import Uebersicht from './pages/Uebersicht';
import Automationen from './pages/Automationen';
import Fehler from './pages/Fehler';
import Protokoll from './pages/Protokoll';
import Zugaenge from './pages/Zugaenge';
import Zeichen, { type ZeichenName } from './components/Icons';
import { relativ } from './lib/format';
import { rolleText } from './lib/labels';

type Seite = 'uebersicht' | 'automationen' | 'fehler' | 'protokoll' | 'zugaenge';

interface Ziel {
  seite: Seite;
  id: string | null;
}

const seiten: Seite[] = ['uebersicht', 'automationen', 'fehler', 'protokoll', 'zugaenge'];

function zielLesen(hash: string): Ziel {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const seite = (teile[0] ?? 'uebersicht') as Seite;
  return {
    seite: seiten.includes(seite) ? seite : 'uebersicht',
    id: teile[1] ?? null,
  };
}

const titel: Record<Seite, string> = {
  uebersicht: 'Übersicht',
  automationen: 'Automationen',
  fehler: 'Fehler',
  protokoll: 'Protokoll',
  zugaenge: 'Zugänge',
};

const navZeichen: Record<Seite, ZeichenName> = {
  uebersicht: 'raster',
  automationen: 'liste',
  fehler: 'warndreieck',
  protokoll: 'uhr',
  zugaenge: 'menschen',
};

function Kopf({ ziel, gehZu }: { ziel: Ziel; gehZu: (pfad: string) => void }) {
  const { profil, rolle, abmelden } = useAnmeldung();
  const { fehler, laden, neuLaden } = useDaten();

  const sichtbar = seiten.filter((seite) => seite !== 'zugaenge' || rolle === 'admin');

  return (
    <header className="kopf">
      <div className="kopfInhalt">
        <div className="marke">
          <span className="markeZeichen">
            <Zeichen name="blitz" groesse={17} />
          </span>
          <span>
            <span className="markeName">Automationen</span>
            <span className="markeUnter">alles an einer Stelle</span>
          </span>
        </div>

        <div className="kopfRechts">
          <button
            type="button"
            className="knopf knopfLeise knopfKlein"
            onClick={() => void neuLaden()}
            disabled={laden}
            aria-label="Zahlen neu laden"
          >
            <Zeichen name="neuLaden" groesse={15} klasse={laden ? 'dreht' : undefined} />
            <span className="nurAufBreit">{laden ? 'Lädt' : 'Neu laden'}</span>
          </button>

          <div className="person">
            <div className="personName">{profil?.full_name ?? profil?.email ?? 'Angemeldet'}</div>
            <div className="personRolle">{rolleText[rolle]}</div>
          </div>

          <button
            type="button"
            className="knopf knopfLeise knopfKlein"
            onClick={() => void abmelden()}
            aria-label="Abmelden"
          >
            <Zeichen name="abmelden" groesse={15} />
            <span className="nurAufBreit">Abmelden</span>
          </button>
        </div>
      </div>

      <nav className="navigation" aria-label="Bereiche">
        {sichtbar.map((seite) => {
          const aktiv = ziel.seite === seite;
          return (
            <button
              key={seite}
              type="button"
              className={`navKnopf ${aktiv ? 'navKnopfAktiv' : ''}`}
              onClick={() => gehZu(`#/${seite}`)}
              aria-current={aktiv ? 'page' : undefined}
            >
              <span className="navZeichen">
                <Zeichen name={navZeichen[seite]} groesse={17} />
              </span>
              {titel[seite]}
              {seite === 'fehler' && fehler.length > 0 ? (
                <span className="navZahl" aria-label={`${fehler.length} offen`}>
                  {fehler.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function Fuss() {
  const { aktualisiertAm } = useDaten();
  return (
    <footer className="fuss">
      {aktualisiertAm
        ? `Zuletzt aktualisiert ${relativ(aktualisiertAm.toISOString())}. Die Zahlen laden sich von selbst nach.`
        : 'Die Zahlen laden sich von selbst nach.'}
    </footer>
  );
}

function AngemeldeteAnsicht() {
  const [hash, setHash] = useState(window.location.hash || '#/uebersicht');

  useEffect(() => {
    const merken = () => setHash(window.location.hash || '#/uebersicht');
    window.addEventListener('hashchange', merken);
    return () => window.removeEventListener('hashchange', merken);
  }, []);

  const ziel = useMemo(() => zielLesen(hash), [hash]);

  useEffect(() => {
    document.title = `${titel[ziel.seite]} · Automationen`;
  }, [ziel.seite]);

  const gehZu = (pfad: string) => {
    window.location.hash = pfad;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DatenProvider>
      <div className="seite">
        <a className="springmarke" href="#inhalt">
          Direkt zum Inhalt
        </a>
        <Kopf ziel={ziel} gehZu={gehZu} />
        <main className="inhalt" id="inhalt">
          {ziel.seite === 'uebersicht' && <Uebersicht gehZu={gehZu} />}
          {ziel.seite === 'automationen' && <Automationen offenId={ziel.id} />}
          {ziel.seite === 'fehler' && <Fehler gehZu={gehZu} />}
          {ziel.seite === 'protokoll' && <Protokoll />}
          {ziel.seite === 'zugaenge' && <Zugaenge />}
        </main>
        <Fuss />
      </div>
    </DatenProvider>
  );
}

function Hinweisseite({
  titelText,
  text,
  aktion,
}: {
  titelText: string;
  text: string;
  aktion?: React.ReactNode;
}) {
  return (
    <main className="anmeldung">
      <div className="anmeldungKarte">
        <div className="anmeldungKopf">
          <span className="markeZeichen">
            <Zeichen name="blitz" groesse={17} />
          </span>
          <h1>{titelText}</h1>
        </div>
        <p className="leise">{text}</p>
        {aktion}
      </div>
    </main>
  );
}

export default function App() {
  const { bereit, session, profil, profilFehlt, profilFehler, abmelden } = useAnmeldung();

  if (!supabaseEingerichtet) {
    return (
      <Hinweisseite
        titelText="Die Verbindung fehlt noch"
        text={
          appUmgebung.istApp
            ? `Trag den Zugangsschlüssel in die Datei konfiguration.json ein und starte das Programm neu. Die Datei liegt unter ${
                appUmgebung.einstellungspfad ?? 'den Einstellungen dieses Programms'
              }. Über Hilfe, Einstellungsordner öffnen kommst du direkt hin.`
            : 'In der Datei .env.local müssen VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY stehen. Danach die Seite neu laden.'
        }
      />
    );
  }

  if (!bereit) {
    return <Hinweisseite titelText="Einen Moment" text="Deine Anmeldung wird geprüft." />;
  }

  if (!session) return <Anmeldung />;

  if (profilFehler) {
    return (
      <Hinweisseite
        titelText="Die Datenbank lässt dich nicht an dein Profil"
        text={`Die Anmeldung hat geklappt, aber das Lesen der Tabelle profiles wird abgelehnt. Das ist eine Einstellung in Supabase, kein Fehler an deinem Konto. Meldung der Datenbank: ${profilFehler}`}
        aktion={
          <>
            <button type="button" className="knopf knopfHaupt" onClick={() => window.location.reload()}>
              <Zeichen name="neuLaden" groesse={15} />
              Nochmal versuchen
            </button>
            <button type="button" className="knopf" onClick={() => void abmelden()}>
              <Zeichen name="abmelden" groesse={15} />
              Abmelden
            </button>
          </>
        }
      />
    );
  }

  if (profilFehlt) {
    return (
      <Hinweisseite
        titelText="Dein Zugang ist noch nicht eingerichtet"
        text="Die Anmeldung hat geklappt, aber zu deinem Konto gibt es noch keinen Eintrag. Sag Amanuel Bescheid, er schaltet dich frei."
        aktion={
          <button type="button" className="knopf" onClick={() => void abmelden()}>
            <Zeichen name="abmelden" groesse={15} />
            Abmelden
          </button>
        }
      />
    );
  }

  if (profil && !profil.active) {
    return (
      <Hinweisseite
        titelText="Dein Zugang ist gesperrt"
        text="Dein Konto ist vorhanden, aber im Moment nicht freigeschaltet. Amanuel kann den Zugang wieder öffnen."
        aktion={
          <button type="button" className="knopf" onClick={() => void abmelden()}>
            <Zeichen name="abmelden" groesse={15} />
            Abmelden
          </button>
        }
      />
    );
  }

  return <AngemeldeteAnsicht />;
}
