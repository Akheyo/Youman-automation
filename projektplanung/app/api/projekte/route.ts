/**
 * GET  → Liste/Suche der eigenen Projekte (Suchverlauf). Query: ?q=<suche>
 * POST → Neues Projekt anlegen: Unterkategorie + Artikel in Plenty, EAN erzeugen,
 *        Datensatz speichern. Body: { company, location, contactInternal?, contactExternal? }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncProjektToPlenty } from '@/lib/plenty/client';
import { validateProjekt, buildCategoryName, type ProjektInput } from '@/lib/projekte/logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  let query = supabase
    .from('projekte')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (q) {
    // Suche über Firma, Ort und Ansprechpartner.
    const like = `%${q.replace(/[%_]/g, '')}%`;
    query = query.or(
      [
        `company.ilike.${like}`,
        `location.ilike.${like}`,
        `contact_internal.ilike.${like}`,
        `contact_external.ilike.${like}`,
        `notes.ilike.${like}`,
        `category_name.ilike.${like}`,
        `ean.ilike.${like}`,
      ].join(','),
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ projekte: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<ProjektInput>;
  const validationError = validateProjekt(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const input: ProjektInput = {
    company: body.company!.trim(),
    location: body.location!.trim(),
    contactInternal: body.contactInternal?.trim() || undefined,
    contactExternal: body.contactExternal?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
  };
  const now = new Date();
  const categoryName = buildCategoryName(input.company, input.location);

  // 1) Datensatz sofort anlegen (Status pending) — nichts geht verloren.
  const { data: row, error: insertError } = await supabase
    .from('projekte')
    .insert({
      user_id: user.id,
      company: input.company,
      location: input.location,
      contact_internal: input.contactInternal ?? null,
      contact_external: input.contactExternal ?? null,
      notes: input.notes ?? null,
      category_name: categoryName,
      plenty_status: 'pending',
    })
    .select()
    .single();
  if (insertError || !row) {
    return NextResponse.json({ error: insertError?.message ?? 'Speichern fehlgeschlagen.' }, { status: 400 });
  }

  // 2) Plenty-Sync (best effort) — eindeutiger EAN-Seed aus Zeit + Zufall.
  const eanSeed = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const sync = await syncProjektToPlenty(input, now, eanSeed);

  // 3) Ergebnis in den Datensatz zurückschreiben.
  const status = sync.skipped ? 'skipped' : sync.ok ? 'ok' : 'error';
  const { data: updated } = await supabase
    .from('projekte')
    .update({
      ean: sync.ean,
      category_name: sync.categoryName,
      plenty_category_id: sync.categoryId,
      plenty_item_id: sync.itemId,
      plenty_status: status,
      plenty_error: sync.error,
    })
    .eq('id', row.id)
    .eq('user_id', user.id)
    .select()
    .single();

  return NextResponse.json({
    projekt: updated ?? row,
    sync: {
      ok: sync.ok,
      skipped: sync.skipped,
      status,
      ean: sync.ean,
      categoryCreated: sync.categoryCreated,
      eanAttached: sync.eanAttached,
      warnings: sync.warnings,
      error: sync.error,
    },
  });
}
