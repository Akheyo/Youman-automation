/**
 * PUT → Sequenz der Kampagne ersetzen.
 *   Body: { steps: [{ delay_days, subject, body }, ...] } in gewünschter
 *   Reihenfolge; step_no wird daraus vergeben. Schritt 1 braucht immer einen
 *   Betreff, ab Schritt 2 darf er leer bleiben (Antwort im selben Verlauf).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_STEPS = 10;

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { steps?: unknown };
  const raw = Array.isArray(body.steps) ? body.steps : null;
  if (!raw || raw.length === 0) return NextResponse.json({ error: 'Die Sequenz braucht mindestens einen Schritt.' }, { status: 400 });
  if (raw.length > MAX_STEPS) return NextResponse.json({ error: `Maximal ${MAX_STEPS} Schritte pro Sequenz.` }, { status: 400 });

  const steps = raw.map((s, i) => {
    const rec = (s ?? {}) as Record<string, unknown>;
    const delay = Number(rec.delay_days);
    return {
      campaign_id: params.id,
      user_id: user.id,
      step_no: i + 1,
      delay_days: Number.isFinite(delay) ? Math.min(90, Math.max(0, Math.round(delay))) : i === 0 ? 0 : 3,
      subject: String(rec.subject ?? '').trim(),
      body: String(rec.body ?? '').trim(),
    };
  });

  if (!steps[0]!.subject) return NextResponse.json({ error: 'Schritt 1 braucht einen Betreff.' }, { status: 400 });
  const empty = steps.find((s) => !s.body);
  if (empty) return NextResponse.json({ error: `Schritt ${empty.step_no} hat keinen Text.` }, { status: 400 });

  // Ersetzen statt patchen: die Reihenfolge ist die Sequenz.
  const { error: delErr } = await supabase.from('outreach_steps').delete().eq('campaign_id', params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  const { data, error } = await supabase.from('outreach_steps').insert(steps).select().order('step_no', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ steps: data });
}
