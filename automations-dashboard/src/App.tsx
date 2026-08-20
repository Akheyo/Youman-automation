import { useEffect, useMemo, useState } from 'react';
import { useAnmeldung } from './lib/auth';
import { DatenProvider, useDaten } from './lib/data';
import { supabaseEingerichtet } from './lib/supabase';
import Anmeldung from './pages/Anmeldung';
import Uebersicht from './pages/Uebersicht';
import Automationen from './pages/Automationen';
import Fehler from './pages/Fehler';
import Protokoll from './pages/Protokoll';
import Zugaenge from './pages/Zugaenge';
import { relativ } from './lib/format';
import { rolleText } from './lib/labels';

type Seite = 'uebersicht' | 'automationen' | 'fehler' | 'protokoll' | 'zugaenge';

interface Ziel {
  seite: Seite;
  id: string | null;
}

function zielLesen(hash: string): Ziel {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const seite = (teile[0] ?? 'uebersicht') as Seite;
  const bekannt: Seite[] = ['uebersicht', 'automationen', 'fehler', 'protokoll', 'zugaenge'];
  return {
    seite: bekannt.includes(seite) ? seite : 'uebersicht',
    id: teile[1] ?? null,
  };
}

function Kopf({ ziel, gehZu }: { ziel: Ziel; gehZu: (pfad: string) => void }) {
  const { profil, rolle, abmelden } = useAnmeldung();
  const { fehler, laden, neuLaden } = useDaten();

  const punkte: Array<{ seite: Seite; name: string; zahl?: number; nurAdmin?: boolean }> = [
    { seite: 'uebersicht', name: 'Übersicht' },
    { seite: 'automationen', name: 'Automationen' },
    { seite: 'fehler', name: 'Fehler', zahl: fehler.length },
    { seite: 'protokoll', name: 'Protokoll' },
    { seite: 'zugaenge', name: 'Zugänge', nurAdmin: true },
  ];

  return (
    <header className="kopf">
      <div className="kopfInhalt">
        <div className="marke">
          Automationen
          <span className="markeLeise">alles an einer Stelle</span>
        </div>
        <div className="kopfRechts">
          <button type="button" className="knopf knopfLeise" onClick={() => void neuLaden()} disabled={laden}>
            {laden ? 'Lädt' : 'Neu laden'}
          </button>
          <div className="person">
            <div className="personName">{profil?.full_name ?? profil?.email ?? 'Angemeldet'}</div>
            <div className="leise">{rolleText[rolle]}</div>
          </div>
          <button type="button" className="knopf knopfLeise" onClick={() => void abmelden()}>
            Abmelden
          </button>
        </div>
      </div>
      <nav className="navigation">
        {punkte
          .filter((punkt) => !punkt.nurAdmin || rolle === 'admin')
          .map((punkt) => (
            <button
              key={punkt.seite}
              type="button"
              className={`navKnopf ${ziel.seite === punkt.seite ? 'navKnopfAktiv' : ''}`}
              onClick={() => gehZu(`#/${punkt.seite}`)}
            >
              {punkt.name}
              {punkt.zahl ? <span className="navZahl">{punkt.zahl}</span> : null}
            </button>
          ))}
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

  const gehZu = (pfad: string) => {
    window.location.hash = pfad;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DatenProvider>
      <div className="seite">
        <Kopf ziel={ziel} gehZu={gehZu} />
        <main className="inhalt">
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

function Hinweisseite({ titel, text, aktion }: { titel: string; text: string; aktion?: React.ReactNode }) {
  return (
    <main className="anmeldung">
      <div className="anmeldungKarte">
        <h1>{titel}</h1>
        <p className="leise">{text}</p>
        {aktion}
      </div>
    </main>
  );
}

export default function App() {
  const { bereit, session, profil, profilFehlt, abmelden } = useAnmeldung();

  if (!supabaseEingerichtet) {
    return (
      <Hinweisseite
        titel="Die Verbindung fehlt noch"
        text="In der Datei .env.local müssen VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY stehen. Danach die Seite neu laden."
      />
    );
  }

  if (!bereit) {
    return <Hinweisseite titel="Einen Moment" text="Deine Anmeldung wird geprüft." />;
  }

  if (!session) return <Anmeldung />;

  if (profilFehlt) {
    return (
      <Hinweisseite
        titel="Dein Zugang ist noch nicht eingerichtet"
        text="Die Anmeldung hat geklappt, aber zu deinem Konto gibt es noch keinen Eintrag. Sag Amanuel Bescheid, er schaltet dich frei."
        aktion={
          <button type="button" className="knopf" onClick={() => void abmelden()}>
            Abmelden
          </button>
        }
      />
    );
  }

  if (profil && !profil.active) {
    return (
      <Hinweisseite
        titel="Dein Zugang ist gesperrt"
        text="Dein Konto ist vorhanden, aber im Moment nicht freigeschaltet. Amanuel kann den Zugang wieder öffnen."
        aktion={
          <button type="button" className="knopf" onClick={() => void abmelden()}>
            Abmelden
          </button>
        }
      />
    );
  }

  return <AngemeldeteAnsicht />;
}
