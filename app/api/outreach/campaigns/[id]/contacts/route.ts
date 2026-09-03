/**
 * GET  → Kontakte der Kampagne (optional nach Status gefiltert).
 * POST → Kontakte hinzufügen. Drei Quellen:
 *          { csv: "<Dateiinhalt>" }        — Import aus Datei
 *          { contacts: [{ email, ... }] }  — direkt übergeben
 *          { fromLeads: true }             — alle Felix-Leads mit E-Mail
 *        Adressen auf der Sperrliste und Dubletten werden übersprungen und
 *        im Ergebnis ausgewiesen.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseContactsCsv, splitName, type ParsedContact } from '@/lib/outreach/csv';
import { isEmail } from '@/lib/outreach/template';
import { nextSendAt } from '@/lib/outreach/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMPORT = 5000;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const status = new URL(request.url).searchParams.get('status');
  let query = supabase
    .from('outreach_contacts')
    .select('id, email, first_name, last_name, company, website, anlass, status, current_step, next_send_at, last_sent_at, last_error')
    .eq('campaign_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let parsed: ParsedContact[] = [];
  let source = 'manual';

  if (typeof body.csv === 'string' && body.csv.trim()) {
    parsed = parseContactsCsv(body.csv);
    source = 'csv';
  } else if (Array.isArray(body.contacts)) {
    source = 'manual';
    for (const raw of body.contacts) {
      const rec = (raw ?? {}) as Record<string, unknown>;
      const email = String(rec.email ?? '').trim().toLowerCase();
      if (!isEmail(email)) continue;
      const full = String(rec.name ?? '').trim();
      const fromFull = full ? splitName(full) : {};
      parsed.push({
        email,
        first_name: String(rec.first_name ?? fromFull.first_name ?? '').trim() || undefined,
        last_name: String(rec.last_name ?? fromFull.last_name ?? '').trim() || undefined,
        company: String(rec.company ?? '').trim() || undefined,
        website: String(rec.website ?? '').trim() || undefined,
        anlass: String(rec.anlass ?? '').trim() || undefined,
        custom: {},
      });
    }
  } else if (body.fromLeads === true) {
    source = 'leads';
    const { data: leads } = await supabase
      .from('leads')
      .select('name, email, website, address, descriptors')
      .eq('user_id', user.id)
      .not('email', 'is', null)
      .limit(MAX_IMPORT);
    for (const l of leads ?? []) {
      const email = String(l.email ?? '').trim().toLowerCase();
      if (!isEmail(email)) continue;
      parsed.push({
        email,
        company: l.name ?? undefined,
        website: l.website ?? undefined,
        anlass: Array.isArray(l.descriptors) && l.descriptors.length ? String(l.descriptors[0]) : undefined,
        custom: {},
      });
    }
  } else {
    return NextResponse.json({ error: 'Keine Kontakte übergeben (csv, contacts oder fromLeads).' }, { status: 400 });
  }

  if (parsed.length === 0) return NextResponse.json({ error: 'Keine gültige E-Mail-Adresse gefunden.' }, { status: 400 });
  if (parsed.length > MAX_IMPORT) parsed = parsed.slice(0, MAX_IMPORT);

  // Sperrliste und bereits vorhandene Kontakte dieser Kampagne aussortieren.
  const emails = parsed.map((p) => p.email);
  const [{ data: blocked }, { data: existing }] = await Promise.all([
    supabase.from('outreach_suppression').select('email').eq('user_id', user.id).in('email', emails),
    supabase.from('outreach_contacts').select('email').eq('campaign_id', params.id).in('email', emails),
  ]);
  const blockedSet = new Set((blocked ?? []).map((b) => b.email));
  const existingSet = new Set((existing ?? []).map((e) => e.email));

  const fresh = parsed.filter((p) => !blockedSet.has(p.email) && !existingSet.has(p.email));
  const skippedBlocked = parsed.length - parsed.filter((p) => !blockedSet.has(p.email)).length;
  const skippedDuplicate = parsed.length - skippedBlocked - fresh.length;

  let imported = 0;
  if (fresh.length > 0) {
    // Läuft die Kampagne bereits, wird der Zugang gleich mit eingeplant.
    const due = campaign.status === 'aktiv' ? nextSendAt(campaign, 0).toISOString() : null;
    const rows = fresh.map((c) => ({
      user_id: user.id,
      campaign_id: params.id,
      email: c.email,
      first_name: c.first_name ?? null,
      last_name: c.last_name ?? null,
      company: c.company ?? null,
      website: c.website ?? null,
      anlass: c.anlass ?? null,
      custom: c.custom ?? {},
      source,
      status: 'neu',
      next_send_at: due,
    }));
    // In Blöcken einfügen, damit große Listen nicht an einer Anfrage hängen.
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await supabase.from('outreach_contacts').insert(rows.slice(i, i + 500)).select('id');
      if (error) return NextResponse.json({ error: error.message, imported }, { status: 400 });
      imported += data?.length ?? 0;
    }
  }

  return NextResponse.json({ imported, skippedBlocked, skippedDuplicate, parsed: parsed.length });
}
