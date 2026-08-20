import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Ein einziger Supabase-Client für die ganze Oberfläche.
 *
 * Es wird ausschließlich der publishable Key (anon) verwendet. Der secret Key
 * gehört niemals ins Frontend. Alle Rechte hängen an Row Level Security in
 * Supabase, die Rollenprüfung im Frontend ist nur die freundliche Hälfte davon.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEingerichtet = Boolean(url && key);

export const supabase: SupabaseClient = createClient(url ?? 'https://beispiel.supabase.co', key ?? 'kein-schluessel', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
