/**
 * POST → add this user's eligible leads to the campaign queue.
 *
 * Eligible = approved, not on the Do-Not-Call list, and not already assigned to
 * a campaign. Sets them ready for the scheduler (next_attempt_at = now).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  const { data, error } = await supabase
    .from('call_leads')
    .update({
      campaign_id: params.id,
      status: 'bereit',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .is('campaign_id', null)
    .eq('approved', true)
    .eq('do_not_call', false)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ added: data?.length ?? 0 });
}
