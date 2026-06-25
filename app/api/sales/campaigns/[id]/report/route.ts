/**
 * GET → aggregated reporting for one campaign: funnel, KPIs and a daily call
 * time series. All scoped to the logged-in user (RLS).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REACHED = ['erreicht', 'qualifiziert', 'termin', 'rueckruf', 'kein_interesse'];
const QUALIFIED = ['qualifiziert', 'termin'];

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  // Campaign must belong to the user.
  const { data: campaign } = await supabase.from('campaigns').select('id, name').eq('id', params.id).eq('user_id', user.id).single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  // Leads in this campaign.
  const { data: leads } = await supabase.from('call_leads').select('id').eq('user_id', user.id).eq('campaign_id', params.id);
  const leadIds = (leads ?? []).map((l) => l.id);
  const leadCount = leadIds.length;

  if (leadIds.length === 0) {
    return NextResponse.json({
      report: { leadCount: 0, calls: 0, reached: 0, qualified: 0, termine: 0, keinInteresse: 0, minutes: 0, avgSec: 0, conversion: 0, series: [] },
    });
  }

  // Finished calls for those leads.
  const { data: calls } = await supabase
    .from('calls')
    .select('outcome, duration_sec, created_at')
    .eq('user_id', user.id)
    .in('lead_id', leadIds)
    .eq('status', 'beendet')
    .limit(5000);

  const rows = calls ?? [];
  const total = rows.length;
  const reached = rows.filter((c) => c.outcome && REACHED.includes(c.outcome)).length;
  const qualified = rows.filter((c) => c.outcome && QUALIFIED.includes(c.outcome)).length;
  const termine = rows.filter((c) => c.outcome === 'termin').length;
  const keinInteresse = rows.filter((c) => c.outcome === 'kein_interesse').length;
  const totalSec = rows.reduce((s, c) => s + (c.duration_sec ?? 0), 0);
  const avgSec = total ? Math.round(totalSec / total) : 0;
  const conversion = total ? Math.round((termine / total) * 100) : 0;

  // Daily time series for the last 14 days.
  const byDay = new Map<string, number>();
  for (const c of rows) {
    const d = (c.created_at ?? '').slice(0, 10);
    if (d) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const series: { day: string; count: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    series.push({ day: d, count: byDay.get(d) ?? 0 });
  }

  return NextResponse.json({
    report: {
      leadCount,
      calls: total,
      reached,
      qualified,
      termine,
      keinInteresse,
      minutes: Math.round(totalSec / 60),
      avgSec,
      conversion,
      series,
    },
  });
}
