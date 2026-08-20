import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseEingerichtet } from './supabase';
import {
  ladeAutomationsUebersicht,
  ladeKennzahlen24h,
  ladeLaufendeDurchlaeufe,
  ladeOffeneBefehle,
  ladeOffeneFehler,
  ladeProfile,
  ladeTrend14d,
  sortiereFehler,
} from './queries';
import type {
  AutomationUebersicht,
  Befehl,
  Durchlauf,
  Kennzahlen24h,
  OffenerFehler,
  Profil,
  Trendtag,
} from './types';

interface Daten {
  laden: boolean;
  ersteLadung: boolean;
  warnungen: string[];
  aktualisiertAm: Date | null;
  kennzahlen: Kennzahlen24h | null;
  trend: Trendtag[];
  automationen: AutomationUebersicht[];
  fehler: OffenerFehler[];
  laufende: Durchlauf[];
  offeneBefehle: Befehl[];
  profile: Profil[];
  profilName: (id: string | null | undefined) => string;
  neuLaden: () => Promise<void>;
}

const Kontext = createContext<Daten | null>(null);

async function versuche<T>(
  name: string,
  arbeit: () => Promise<T>,
  warnungen: string[],
  vorgabe: T,
): Promise<T> {
  try {
    return await arbeit();
  } catch (fehler) {
    const meldung = fehler instanceof Error ? fehler.message : `${name} konnte nicht geladen werden.`;
    warnungen.push(meldung);
    return vorgabe;
  }
}

export function DatenProvider({ children }: { children: React.ReactNode }) {
  const [laden, setLaden] = useState(true);
  const [ersteLadung, setErsteLadung] = useState(true);
  const [warnungen, setWarnungen] = useState<string[]>([]);
  const [aktualisiertAm, setAktualisiertAm] = useState<Date | null>(null);
  const [kennzahlen, setKennzahlen] = useState<Kennzahlen24h | null>(null);
  const [trend, setTrend] = useState<Trendtag[]>([]);
  const [automationen, setAutomationen] = useState<AutomationUebersicht[]>([]);
  const [fehler, setFehler] = useState<OffenerFehler[]>([]);
  const [laufende, setLaufende] = useState<Durchlauf[]>([]);
  const [offeneBefehle, setOffeneBefehle] = useState<Befehl[]>([]);
  const [profile, setProfile] = useState<Profil[]>([]);
  const laeuftGerade = useRef(false);

  const neuLaden = useCallback(async () => {
    if (!supabaseEingerichtet || laeuftGerade.current) return;
    laeuftGerade.current = true;
    setLaden(true);
    const gesammelt: string[] = [];

    const [k, t, a, f, l, b, p] = await Promise.all([
      versuche('Die Kennzahlen', ladeKennzahlen24h, gesammelt, null as Kennzahlen24h | null),
      versuche('Der Verlauf', ladeTrend14d, gesammelt, [] as Trendtag[]),
      versuche('Die Automationen', ladeAutomationsUebersicht, gesammelt, [] as AutomationUebersicht[]),
      versuche('Die Fehler', ladeOffeneFehler, gesammelt, [] as OffenerFehler[]),
      versuche('Die laufenden Durchläufe', ladeLaufendeDurchlaeufe, gesammelt, [] as Durchlauf[]),
      versuche('Die offenen Aufträge', ladeOffeneBefehle, gesammelt, [] as Befehl[]),
      versuche('Die Zugänge', ladeProfile, gesammelt, [] as Profil[]),
    ]);

    setKennzahlen(k);
    setTrend(t);
    setAutomationen(a);
    setFehler(sortiereFehler(f));
    setLaufende(l);
    setOffeneBefehle(b);
    setProfile(p);
    setWarnungen(gesammelt);
    setAktualisiertAm(new Date());
    setLaden(false);
    setErsteLadung(false);
    laeuftGerade.current = false;
  }, []);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  /* Alle 60 Sekunden nachschauen, damit die Zahlen ohne Zutun aktuell bleiben. */
  useEffect(() => {
    const uhr = window.setInterval(() => {
      if (document.visibilityState === 'visible') void neuLaden();
    }, 60000);
    return () => window.clearInterval(uhr);
  }, [neuLaden]);

  /* Realtime ist die Kür. Fällt sie aus, bleibt der Takt von oben. */
  useEffect(() => {
    if (!supabaseEingerichtet) return;
    let zeitgeber: number | undefined;

    const angestossen = () => {
      window.clearTimeout(zeitgeber);
      zeitgeber = window.setTimeout(() => void neuLaden(), 1200);
    };

    try {
      const kanal = supabase
        .channel('dashboard-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_runs' }, angestossen)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_errors' }, angestossen)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'control_commands' }, angestossen)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automations' }, angestossen)
        .subscribe();

      return () => {
        window.clearTimeout(zeitgeber);
        void supabase.removeChannel(kanal);
      };
    } catch {
      return () => window.clearTimeout(zeitgeber);
    }
  }, [neuLaden]);

  const profilName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return 'die Automation selbst';
      const treffer = profile.find((eintrag) => eintrag.id === id);
      if (!treffer) return 'unbekannt';
      return treffer.full_name?.trim() || treffer.email || 'unbekannt';
    },
    [profile],
  );

  const wert = useMemo<Daten>(
    () => ({
      laden,
      ersteLadung,
      warnungen,
      aktualisiertAm,
      kennzahlen,
      trend,
      automationen,
      fehler,
      laufende,
      offeneBefehle,
      profile,
      profilName,
      neuLaden,
    }),
    [
      laden,
      ersteLadung,
      warnungen,
      aktualisiertAm,
      kennzahlen,
      trend,
      automationen,
      fehler,
      laufende,
      offeneBefehle,
      profile,
      profilName,
      neuLaden,
    ],
  );

  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

export function useDaten(): Daten {
  const wert = useContext(Kontext);
  if (!wert) throw new Error('useDaten braucht den DatenProvider.');
  return wert;
}
