/**
 * POST → bulk-import phone leads from a CSV. Body: { csv: string }.
 * CSV-imported leads need an explicit go before Lina calls them (needs_approval).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseLeadsCsv } from '@/lib/sales/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { csv?: string };
  const parsed = parseLeadsCsv(body.csv ?? '');
  if (parsed.length === 0) return NextResponse.json({ error: 'Keine gültigen Zeilen mit Telefonnummer gefunden.' }, { status: 400 });

  const rows = parsed.map((l) => ({
    user_id: user.id,
    name: l.name ?? null,
    company: l.company ?? null,
    phone: l.phone,
    website: l.website ?? null,
    email: l.email ?? null,
    notes: l.notes ?? null,
    source: 'csv',
    interest: 'unknown',
    approved: false,
    needs_approval: true,
    status: 'neu',
  }));

  const { data, error } = await supabase.from('call_leads').insert(rows).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ imported: data?.length ?? 0 });
}
