import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Zeichen from './Icons';

type Ton = 'blau' | 'rot';

interface Hinweis {
  id: number;
  text: string;
  ton: Ton;
}

interface Steuerung {
  zeigen: (text: string, ton?: Ton) => void;
}

const Kontext = createContext<Steuerung | null>(null);

let naechsteId = 1;

/** Kurze Rückmeldung nach einer Aktion. Fehler bleiben länger stehen. */
export function HinweiseProvider({ children }: { children: React.ReactNode }) {
  const [hinweise, setHinweise] = useState<Hinweis[]>([]);

  const schliessen = useCallback((id: number) => {
    setHinweise((vorher) => vorher.filter((eintrag) => eintrag.id !== id));
  }, []);

  const zeigen = useCallback(
    (text: string, ton: Ton = 'blau') => {
      const id = naechsteId++;
      setHinweise((vorher) => [...vorher.slice(-2), { id, text, ton }]);
      window.setTimeout(() => schliessen(id), ton === 'rot' ? 10000 : 5000);
    },
    [schliessen],
  );

  const wert = useMemo(() => ({ zeigen }), [zeigen]);

  return (
    <Kontext.Provider value={wert}>
      {children}
      <div className="hinweise" role="status" aria-live="polite">
        {hinweise.map((hinweis) => (
          <div key={hinweis.id} className={`hinweis ${hinweis.ton === 'rot' ? 'hinweisRot' : 'hinweisBlau'}`}>
            <span className="hinweisZeichen">
              <Zeichen name={hinweis.ton === 'rot' ? 'warndreieck' : 'haken'} groesse={16} />
            </span>
            <span className="hinweisText">{hinweis.text}</span>
            <button
              type="button"
              className="hinweisZu"
              onClick={() => schliessen(hinweis.id)}
              aria-label="Hinweis schließen"
            >
              <Zeichen name="schliessen" groesse={14} />
            </button>
          </div>
        ))}
      </div>
    </Kontext.Provider>
  );
}

export function useHinweise(): Steuerung {
  const wert = useContext(Kontext);
  if (!wert) throw new Error('useHinweise braucht den HinweiseProvider.');
  return wert;
}
