import { useState } from 'react';
import { useAnmeldung } from '../lib/auth';
import { Meldung } from '../components/Bausteine';

export default function Anmeldung() {
  const { anmelden, passwortVergessen } = useAnmeldung();
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [laeuft, setLaeuft] = useState(false);
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
    setLaeuft(true);
    const meldung = await anmelden(email, passwort);
    setLaeuft(false);
    if (meldung) setFehler(meldung);
  };

  const neuesPasswort = async () => {
    setFehler(null);
    setHinweis(null);
    if (!email.trim()) {
      setFehler('Trag zuerst deine E-Mail-Adresse ein, dann schicken wir dir einen Link.');
      return;
    }
    setLaeuft(true);
    const meldung = await passwortVergessen(email);
    setLaeuft(false);
    if (meldung) setFehler(meldung);
    else setHinweis('Wir haben dir einen Link geschickt. Schau in dein Postfach, auch im Spam-Ordner.');
  };

  return (
    <main className="anmeldung">
      <form className="anmeldungKarte" onSubmit={absenden}>
        <div>
          <h1>Automationen</h1>
          <p className="leise">Melde dich an, um den Zustand aller Automationen zu sehen.</p>
        </div>

        {fehler && <Meldung ton="rot">{fehler}</Meldung>}
        {hinweis && <Meldung ton="blau">{hinweis}</Meldung>}

        <label className="feld">
          <span className="feldName">E-Mail</span>
          <input
            type="email"
            value={email}
            autoComplete="email"
            autoFocus
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

        <button type="submit" className="knopf knopfHaupt" disabled={laeuft}>
          {laeuft ? 'Einen Moment' : 'Anmelden'}
        </button>

        <button type="button" className="knopf knopfLeise" onClick={neuesPasswort} disabled={laeuft}>
          Passwort vergessen
        </button>

        <p className="leise">
          Noch keinen Zugang? Amanuel Kheyo legt ihn an.
        </p>
      </form>
    </main>
  );
}
