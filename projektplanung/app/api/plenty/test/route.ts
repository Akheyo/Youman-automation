/**
 * GET → prüft die PlentyONE-Verbindung (Login-Test). Nur für eingeloggte Nutzer.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { testPlentyConnection } from '@/lib/plenty/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }
  const result = await testPlentyConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
