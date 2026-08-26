/**
 * GET → leitet auf eine frische Signed-URL der gespeicherten Rechnung weiter.
 * Nur für den Eigentümer des Projekts.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: row } = await supabase
    .from('projekte')
    .select('invoice_path')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!row?.invoice_path) return NextResponse.json({ error: 'Keine Rechnung hinterlegt.' }, { status: 404 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Storage nicht konfiguriert.' }, { status: 503 });
  const signed = await admin.storage.from('rechnungen').createSignedUrl(row.invoice_path, 300);
  if (!signed.data?.signedUrl) return NextResponse.json({ error: 'Link konnte nicht erzeugt werden.' }, { status: 500 });

  return NextResponse.redirect(signed.data.signedUrl);
}
