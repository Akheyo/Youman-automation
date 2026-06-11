/**
 * Supabase server client (App Router). Reads/writes the auth session via
 * Next.js cookies. Use inside Server Components, Route Handlers and Server
 * Actions.
 *
 * Returns null when Supabase is not configured (env vars missing) so the app
 * keeps working during the SaaS rollout instead of crashing.
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
            // Called from a Server Component — ignore; middleware refreshes the session.
          }
        },
      },
    },
  );
}

/** Convenience: the current logged-in user, or null. */
export async function getUser() {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * For protected app pages: returns the authed Supabase client + user, or
 * redirects. In open mode (Supabase unconfigured) sends to the open app.
 */
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  if (!supabaseConfigured()) redirect('/felix');
  const supabase = createClient()!;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}
