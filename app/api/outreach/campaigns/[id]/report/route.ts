/**
 * GET → Kennzahlen einer Kampagne: Versand je Schritt, Antwortquote,
 *       Abmeldungen, Fehler und die letzten Ereignisse.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('id, name, status, track_opens')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  const [{ data: events }, { data: contacts }, { data: recent }] = await Promise.all([
    supabase.from('outreach_events').select('kind, step_no').eq('campaign_id', campaign.id),
    supabase.from('outreach_contacts').select('status').eq('campaign_id', campaign.id),
    supabase
      .from('outreach_events')
      .select('created_at, kind, step_no, subject, detail, contact_id')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const perStep = new Map<number, number>();
  const byKind: Record<string, number> = {};
  for (const e of events ?? []) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    if (e.kind === 'gesendet' && e.step_no != null) perStep.set(e.step_no, (perStep.get(e.step_no) ?? 0) + 1);
  }

  const byStatus: Record<string, number> = {};
  for (const c of contacts ?? []) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

  const gesendet = byKind.gesendet ?? 0;
  const geantwortet = byKind.geantwortet ?? 0;
  const abgemeldet = byKind.abgemeldet ?? 0;
  const geoeffnet = byKind.geoeffnet ?? 0;
  const rate = (n: number) => (gesendet > 0 ? Math.round((n / gesendet) * 1000) / 10 : 0);

  return NextResponse.json({
    campaign,
    total: (contacts ?? []).length,
    byStatus,
    byKind,
    perStep: [...perStep.entries()].sort((a, b) => a[0] - b[0]).map(([step_no, count]) => ({ step_no, count })),
    quoten: { antwortquote: rate(geantwortet), abmeldequote: rate(abgemeldet), oeffnungsrate: rate(geoeffnet) },
    trackOpens: campaign.track_opens === true,
    recent: recent ?? [],
  });
}
