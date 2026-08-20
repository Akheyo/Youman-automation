import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseEingerichtet } from './supabase';
import { fehlerText } from './queries';
import type { Profil, Rolle } from './types';

interface Anmeldung {
  bereit: boolean;
  session: Session | null;
  profil: Profil | null;
  profilFehlt: boolean;
  profilFehler: string | null;
  rolle: Rolle;
  darfSteuern: boolean;
  darfVerwalten: boolean;
  anmelden: (email: string, passwort: string) => Promise<string | null>;
  passwortVergessen: (email: string) => Promise<string | null>;
  abmelden: () => Promise<void>;
  profilNeuLaden: () => Promise<void>;
}

const Kontext = createContext<Anmeldung | null>(null);

/** Fehlermeldungen von Supabase in verständliches Deutsch übersetzen. */
function anmeldeFehler(meldung: string): string {
  const m = meldung.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'E-Mail oder Passwort stimmen nicht. Bitte noch einmal versuchen.';
  }
  if (m.includes('email not confirmed')) {
    return 'Die E-Mail-Adresse ist noch nicht bestätigt. Schau in dein Postfach.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Zu viele Versuche in kurzer Zeit. Warte eine Minute und versuche es erneut.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.';
  }
  return meldung;
}

export function AnmeldungProvider({ children }: { children: React.ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [profilFehlt, setProfilFehlt] = useState(false);
  const [profilFehler, setProfilFehler] = useState<string | null>(null);

  const profilLaden = useCallback(async (benutzerId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, active')
      .eq('id', benutzerId)
      .maybeSingle();

    /*
     * Zwei sehr verschiedene Fälle, die nicht dieselbe Meldung bekommen dürfen:
     * Es gibt keine Zeile zu diesem Konto, oder die Datenbank lässt das Lesen
     * nicht zu. Im zweiten Fall hilft nur die technische Meldung weiter.
     */
    if (error) {
      setProfil(null);
      setProfilFehlt(false);
      setProfilFehler(fehlerText(error, 'Dein Profil') ?? error.message);
      return;
    }
    if (!data) {
      setProfil(null);
      setProfilFehler(null);
      setProfilFehlt(true);
      return;
    }
    setProfil(data as Profil);
    setProfilFehlt(false);
    setProfilFehler(null);
  }, []);

  useEffect(() => {
    if (!supabaseEingerichtet) {
      setBereit(true);
      return;
    }

    let abgemeldet = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (abgemeldet) return;
      setSession(data.session);
      if (data.session?.user) await profilLaden(data.session.user.id);
      setBereit(true);
    });

    const { data: beobachter } = supabase.auth.onAuthStateChange((_ereignis, neueSession) => {
      setSession(neueSession);
      if (neueSession?.user) {
        void profilLaden(neueSession.user.id);
      } else {
        setProfil(null);
        setProfilFehlt(false);
        setProfilFehler(null);
      }
    });

    return () => {
      abgemeldet = true;
      beobachter.subscription.unsubscribe();
    };
  }, [profilLaden]);

  const anmelden = useCallback(async (email: string, passwort: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: passwort });
    if (error) return anmeldeFehler(error.message);
    return null;
  }, []);

  const passwortVergessen = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) return anmeldeFehler(error.message);
    return null;
  }, []);

  const abmelden = useCallback(async () => {
    await supabase.auth.signOut();
    setProfil(null);
  }, []);

  const profilNeuLaden = useCallback(async () => {
    if (session?.user) await profilLaden(session.user.id);
  }, [profilLaden, session]);

  const wert = useMemo<Anmeldung>(() => {
    const rolle: Rolle = profil?.role ?? 'viewer';
    return {
      bereit,
      session,
      profil,
      profilFehlt,
      profilFehler,
      rolle,
      darfSteuern: rolle === 'operator' || rolle === 'admin',
      darfVerwalten: rolle === 'admin',
      anmelden,
      passwortVergessen,
      abmelden,
      profilNeuLaden,
    };
  }, [bereit, session, profil, profilFehlt, profilFehler, anmelden, passwortVergessen, abmelden, profilNeuLaden]);

  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

export function useAnmeldung(): Anmeldung {
  const wert = useContext(Kontext);
  if (!wert) throw new Error('useAnmeldung braucht den AnmeldungProvider.');
  return wert;
}
