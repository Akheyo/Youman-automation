/**
 * Service-role Supabase client for server-only tasks that run WITHOUT a logged-in
 * user — e.g. the Stripe webhook updating a profile's plan. Bypasses RLS, so it
 * must never be imported into client code.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
