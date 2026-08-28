import type { Metadata } from 'next';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { plentyConfigured } from '@/lib/plenty/client';
import ProjektDashboard, { type Projekt } from './ProjektDashboard';

export const metadata: Metadata = { title: 'Projekte · Komplett Konzept Projektplanung' };
export const dynamic = 'force-dynamic';

export default async function ProjektePage() {
  let initial: Projekt[] = [];

  if (supabaseConfigured()) {
    const { supabase, user } = await requireUser();
    const { data } = await supabase
      .from('projekte')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    initial = (data ?? []) as Projekt[];
  }

  return <ProjektDashboard initial={initial} plentyReady={plentyConfigured()} supabaseReady={supabaseConfigured()} />;
}
