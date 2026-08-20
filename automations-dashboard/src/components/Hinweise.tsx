import { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

export function HinweiseProvider({ children }: { children: React.ReactNode }) {
  const [hinweise, setHinweise] = useState<Hinweis[]>([]);

  const zeigen = useCallback((text: string, ton: Ton = 'blau') => {
    const id = naechsteId++;
    setHinweise((vorher) => [...vorher, { id, text, ton }]);
    window.setTimeout(() => {
      setHinweise((vorher) => vorher.filter((eintrag) => eintrag.id !== id));
    }, ton === 'rot' ? 9000 : 5000);
  }, []);

  const wert = useMemo(() => ({ zeigen }), [zeigen]);

  return (
    <Kontext.Provider value={wert}>
      {children}
      <div className="hinweise" role="status" aria-live="polite">
        {hinweise.map((hinweis) => (
          <div key={hinweis.id} className={`hinweis ${hinweis.ton === 'rot' ? 'hinweisRot' : 'hinweisBlau'}`}>
            <span className={`punkt ${hinweis.ton === 'rot' ? 'punktRot' : 'punktBlau'}`} aria-hidden="true" />
            <span>{hinweis.text}</span>
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
