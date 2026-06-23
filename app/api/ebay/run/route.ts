/**
 * POST → run the eBay listing sync once for the logged-in user ("Jetzt
 *        synchronisieren" button). The same engine the cron uses, scoped to
 *        the caller only.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncEbayForUser } from '@/lib/ebay/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Service-Role-Key fehlt (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });

  const result = await syncEbayForUser(admin, user.id);
  return NextResponse.json({ result });
}
