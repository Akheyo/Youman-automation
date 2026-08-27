/**
 * GET /api/plenty/uitest → prüft, wie sich ein Server-Aufruf gegenüber Plentys
 * interner ui.php ausweisen kann. Reines Diagnose-Werkzeug.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { probeUiEndpoint } from '@/lib/plenty/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  try {
    return NextResponse.json(await probeUiEndpoint());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
