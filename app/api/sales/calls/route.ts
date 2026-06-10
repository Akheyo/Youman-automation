/**
 * GET → list the user's calls (newest first) with transcript + summary, plus
 *       the lead name joined in for display.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: calls } = await supabase
    .from('calls')
    .select('*, call_leads(name, company, phone)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ calls: calls ?? [], meetings: meetings ?? [] });
}
