/**
 * Gemeinsamer Einstieg der Fotostudio-Routen: angemeldeter Nutzer und der
 * Artikel samt Bildern — oder eine fertige Fehlerantwort.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export interface StudioBild {
  id: string;
  position: number;
  pfad: string;
  hochgeladen: boolean;
}

export interface StudioArtikel {
  id: string;
  nummer: number;
  status: string;
  quelle: string | null;
  zustand: string | null;
  bestand: number | null;
  gewicht_kg: number | string | null;
  ean: string | null;
  plenty: unknown;
  bilder: StudioBild[] | null;
}

export type Zugriff =
  | { antwort: NextResponse }
  | { antwort?: undefined; supabase: SupabaseClient; artikel: StudioArtikel };

export async function ladeStudioArtikel(id: string): Promise<Zugriff> {
  const supabase = createClient();
  if (!supabase) {
    return { antwort: NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 }) };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { antwort: NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 }) };

  const { data, error } = await supabase
    .from('erfassung_artikel')
    .select('id, nummer, status, quelle, zustand, bestand, gewicht_kg, ean, plenty, bilder:erfassung_bilder (id, position, pfad, hochgeladen)')
    .eq('id', id)
    .single();
  if (error || !data) {
    return { antwort: NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 }) };
  }
  const artikel = data as unknown as StudioArtikel;
  if (artikel.quelle !== 'fotostudio') {
    return {
      antwort: NextResponse.json({ error: 'Dieser Artikel gehört zur Erfassung, nicht zum Fotostudio.' }, { status: 409 }),
    };
  }
  return { supabase, artikel };
}
