import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Ein einziger Supabase-Client für die ganze Oberfläche.
 *
 * Es wird ausschließlich der publishable Key (anon) verwendet. Der secret Key
 * gehört niemals ins Frontend. Alle Rechte hängen an Row Level Security in
 * Supabase, die Rollenprüfung im Frontend ist nur die freundliche Hälfte davon.
 *
 * Im Browser kommen die Werte aus .env.local beziehungsweise aus den
 * Umgebungsvariablen des Deployments. In der Windows-App stehen sie zusätzlich
 * in einer Datei neben den Einstellungen, damit ein neuer Schlüssel kein neues
 * Setup braucht.
 */

export interface AppUmgebung {
  istApp?: boolean;
  url?: string;
  schluessel?: string;
  einstellungspfad?: string;
  version?: string;
}

export const appUmgebung: AppUmgebung =
  (globalThis as unknown as { automationen?: AppUmgebung }).automationen ?? {};

function ersterWert(...werte: Array<string | undefined>): string | undefined {
  return werte.find((wert) => typeof wert === 'string' && wert.trim().length > 0)?.trim();
}

const url = ersterWert(import.meta.env.VITE_SUPABASE_URL as string | undefined, appUmgebung.url);
const key = ersterWert(
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  appUmgebung.schluessel,
);

export const supabaseEingerichtet = Boolean(url && key);

export const supabase: SupabaseClient = createClient(url ?? 'https://beispiel.supabase.co', key ?? 'kein-schluessel', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
