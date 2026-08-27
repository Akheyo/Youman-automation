/**
 * GET /api/plenty/properties → kompakte Liste aller Plenty-Merkmale.
 * Diagnose-Werkzeug: zeigt die echte ID und den Typ von „Dokument 1".
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listPlentyProperties } from '@/lib/plenty/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  try {
    return NextResponse.json(await listPlentyProperties());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
