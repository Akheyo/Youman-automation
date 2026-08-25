/**
 * Supabase Server-Client (App Router). Liest/schreibt die Session über die
 * Next.js-Cookies. In Server Components, Route Handlers und Server Actions nutzen.
 *
 * Gibt null zurück, wenn Supabase nicht konfiguriert ist (Env-Variablen fehlen),
 * damit die App im "offenen Modus" ohne Login lauffähig bleibt.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createClient(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Aus einer Server Component aufgerufen – Middleware aktualisiert die Session.
          }
        },
      },
    },
  );
}

/** Bequem: der aktuell eingeloggte Nutzer oder null. */
export async function getUser(): Promise<User | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Für geschützte Seiten: liefert Client + Nutzer oder leitet zum Login um.
 */
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  if (!supabaseConfigured()) redirect('/login');
  const supabase = createClient()!;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}
