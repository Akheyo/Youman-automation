/**
 * GET /api/plenty/inspect?itemId=123 → rohe Varianteneigenschaften eines Artikels.
 * Reines Diagnose-Werkzeug: zeigt, welche Felder Plenty bei einem manuell
 * hochgeladenen Dokument setzt. Nur für angemeldete Nutzer.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { inspectItemProperties } from '@/lib/plenty/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const itemId = Number(new URL(request.url).searchParams.get('itemId'));
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'itemId fehlt, z. B. /api/plenty/inspect?itemId=71459' }, { status: 400 });
  }

  try {
    return NextResponse.json(await inspectItemProperties(itemId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
