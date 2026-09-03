/**
 * Supabase-Zugriff fuer den Shop.
 *
 * Bestellungen schreibt ausschliesslich der Server mit dem Service-Role-Key —
 * Gaeste haben keinen Login und duerfen fremde Bestellungen weder lesen noch
 * aendern. Row Level Security in `db/schema.sql` verweigert deshalb jeden
 * Zugriff ueber den oeffentlichen Anon-Key.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function dbKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!dbKonfiguriert()) throw new Error('Supabase ist nicht konfiguriert.');
  if (!cached) {
    cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/**
 * Prueft den Schluessel, mit dem sich das Kuechen-Tablet ausweist.
 * Zeitkonstanter Vergleich, damit der Schluessel nicht ueber die Antwortzeit
 * erraten werden kann.
 */
export function kuechenSchluesselGueltig(header: string | null): boolean {
  const erwartet = process.env.KUECHEN_TOKEN;
  if (!erwartet || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(erwartet);
  if (a.length !== b.length) return false;
  let gleich = 0;
  for (let i = 0; i < a.length; i++) gleich |= a[i] ^ b[i];
  return gleich === 0;
}
