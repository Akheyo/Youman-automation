/**
 * PATCH  → Kontakt steuern: { action: 'stoppen' | 'fortsetzen' | 'geantwortet'
 *          | 'sperren' } oder einzelne Felder ({ first_name, company, anlass … }).
 *          'sperren' setzt die Adresse zusätzlich kontoweit auf die Sperrliste.
 * DELETE → Kontakt aus der Kampagne entfernen (die Sperrliste bleibt bestehen).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nextSendAt } from '@/lib/outreach/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = ['first_name', 'last_name', 'company', 'website', 'anlass'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: contact } = await supabase
    .from('outreach_contacts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!contact) return NextResponse.json({ error: 'Kontakt nicht gefunden.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) patch[f] = String(body[f] ?? '').trim() || null;

  const action = String(body.action ?? '');
  if (action === 'stoppen') {
    patch.status = 'gestoppt';
    patch.next_send_at = null;
  } else if (action === 'fortsetzen') {
    const { data: campaign } = await supabase
      .from('outreach_campaigns')
      .select('*')
      .eq('id', contact.campaign_id)
      .single();
    patch.status = contact.current_step > 0 ? 'aktiv' : 'neu';
    patch.last_error = null;
    patch.fails = 0;
    patch.next_send_at = campaign ? nextSendAt(campaign, 0).toISOString() : new Date().toISOString();
  } else if (action === 'geantwortet') {
    patch.status = 'geantwortet';
    patch.next_send_at = null;
    await supabase.from('outreach_events').insert({
      user_id: user.id,
      campaign_id: contact.campaign_id,
      contact_id: contact.id,
      step_no: contact.current_step,
      kind: 'geantwortet',
      detail: 'Manuell als beantwortet markiert.',
    });
  } else if (action === 'sperren') {
    patch.status = 'abgemeldet';
    patch.next_send_at = null;
    await supabase
      .from('outreach_suppression')
      .upsert({ user_id: user.id, email: String(contact.email).toLowerCase(), reason: 'manuell' }, { onConflict: 'user_id,email' });
    await supabase.from('outreach_events').insert({
      user_id: user.id,
      campaign_id: contact.campaign_id,
      contact_id: contact.id,
      kind: 'abgemeldet',
      detail: 'Manuell gesperrt.',
    });
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nichts zu ändern.' }, { status: 400 });

  const { data, error } = await supabase
    .from('outreach_contacts')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { error } = await supabase.from('outreach_contacts').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
