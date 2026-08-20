import { useState } from 'react';
import { useAnmeldung } from '../lib/auth';
import { Meldung } from '../components/Bausteine';
import Zeichen from '../components/Icons';

export default function Anmeldung() {
  const { anmelden, passwortVergessen } = useAnmeldung();
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [laeuft, setLaeuft] = useState<'anmelden' | 'passwort' | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const absenden = async (ereignis: React.FormEvent) => {
    ereignis.preventDefault();
    setFehler(null);
    setHinweis(null);
    if (!email.trim() || !passwort) {
      setFehler('Bitte E-Mail und Passwort eintragen.');
      return;
    }
    setLaeuft('anmelden');
    const meldung = await anmelden(email, passwort);
    setLaeuft(null);
    if (meldung) setFehler(meldung);
  };

  const neuesPasswort = async () => {
    setFehler(null);
    setHinweis(null);
    if (!email.trim()) {
      setFehler('Trag zuerst deine E-Mail-Adresse ein, dann schicken wir dir einen Link.');
      return;
    }
    setLaeuft('passwort');
    const meldung = await passwortVergessen(email);
    setLaeuft(null);
    if (meldung) setFehler(meldung);
    else setHinweis('Wir haben dir einen Link geschickt. Schau in dein Postfach, auch im Spam-Ordner.');
  };

  return (
    <main className="anmeldung">
      <form className="anmeldungKarte" onSubmit={absenden} noValidate>
        <div className="anmeldungKopf">
          <span className="markeZeichen">
            <Zeichen name="blitz" groesse={17} />
          </span>
          <div>
            <h1>Automationen</h1>
            <p className="leise klein">Alle Automationen an einer Stelle</p>
          </div>
        </div>

        <p className="leise">Melde dich an, um den Zustand aller Automationen zu sehen.</p>

        <div aria-live="polite">
          {fehler && <Meldung ton="rot">{fehler}</Meldung>}
          {hinweis && <Meldung ton="blau">{hinweis}</Meldung>}
        </div>

        <label className="feld">
          <span className="feldName">E-Mail</span>
          <input
            type="email"
            value={email}
            autoComplete="email"
            autoFocus
            inputMode="email"
            onChange={(ereignis) => setEmail(ereignis.target.value)}
            placeholder="vorname.nachname@firma.de"
          />
        </label>

        <label className="feld">
          <span className="feldName">Passwort</span>
          <input
            type="password"
            value={passwort}
            autoComplete="current-password"
            onChange={(ereignis) => setPasswort(ereignis.target.value)}
          />
        </label>

        <button type="submit" className="knopf knopfHaupt" disabled={laeuft !== null}>
          <Zeichen name={laeuft === 'anmelden' ? 'kreisel' : 'schild'} groesse={15} klasse={laeuft === 'anmelden' ? 'dreht' : undefined} />
          {laeuft === 'anmelden' ? 'Einen Moment' : 'Anmelden'}
        </button>

        <button type="button" className="knopf knopfLeise" onClick={neuesPasswort} disabled={laeuft !== null}>
          Passwort vergessen
        </button>

        <p className="leise klein">Noch keinen Zugang? Amanuel Kheyo legt ihn an.</p>
      </form>
    </main>
  );
}
