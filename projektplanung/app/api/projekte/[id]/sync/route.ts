/**
 * POST → Plenty-Sync für ein bestehendes Projekt (erneut) ausführen.
 * Behält die bereits vergebene EAN. Nutzbar als „Erneut synchronisieren".
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncProjektToPlenty } from '@/lib/plenty/client';
import type { ProjektInput } from '@/lib/projekte/logic';

const SIGNED_URL_TTL = 60 * 60 * 24 * 3650; // ~10 Jahre

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: row, error } = await supabase
    .from('projekte')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (error || !row) return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 });

  const input: ProjektInput = {
    company: row.company,
    location: row.location,
    contactInternal: row.contact_internal ?? undefined,
    contactExternal: row.contact_external ?? undefined,
    notes: row.notes ?? undefined,
    orderType: row.order_type ?? undefined,
  };
  // Falls eine Rechnung hinterlegt ist: frischen Link erzeugen, damit er wieder
  // in der Plenty-Artikelbeschreibung landet.
  if (row.invoice_path) {
    const admin = createAdminClient();
    if (admin) {
      const signed = await admin.storage.from('rechnungen').createSignedUrl(row.invoice_path, SIGNED_URL_TTL);
      if (signed.data?.signedUrl) input.invoiceUrl = signed.data.signedUrl;
    }
  }

  const date = row.created_at ? new Date(row.created_at) : new Date();
  const eanSeed = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const sync = await syncProjektToPlenty(input, date, eanSeed, row.ean);

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
      invoiceAttached: sync.invoiceAttached,
      invoiceStored: Boolean(row.invoice_path),
      warnings: sync.warnings,
      error: sync.error,
    },
  });
}
