/**
 * PATCH  → update a lead (e.g. approve it to be called, edit fields).
 *          Body: { approved?, status?, interest?, name?, notes?, ... }
 * DELETE → remove a lead.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = ['name', 'company', 'phone', 'website', 'email', 'notes', 'anlass', 'interest', 'status', 'follow_up_at', 'follow_up_note'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) patch[f] = body[f];

  // Approving a lead clears it for calling.
  if (typeof body.approved === 'boolean') {
    patch.approved = body.approved;
    patch.needs_approval = !body.approved;
    if (body.approved && !('status' in body)) patch.status = 'bereit';
  }

  const { data, error } = await supabase
    .from('call_leads')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { error } = await supabase.from('call_leads').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
