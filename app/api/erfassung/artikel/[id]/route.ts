/**
 * DELETE → Angefangenen Artikel verwerfen (Fehlstart am Regal).
 *
 * Nur solange er offen ist. Was einmal abgeschickt wurde, verschwindet nicht
 * mehr per Wisch — dafür gibt es später die Freigabe.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminOderFehler, bilderEntfernen } from '@/lib/erfassung/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: artikel } = await supabase
    .from('erfassung_artikel')
    .select('id, status, bilder:erfassung_bilder (pfad)')
    .eq('id', params.id)
    .single();
  if (!artikel) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });
  if (artikel.status !== 'offen') {
    return NextResponse.json({ error: 'Nur offene Artikel lassen sich verwerfen.' }, { status: 409 });
  }

  const pfade = ((artikel.bilder ?? []) as Array<{ pfad: string }>).map((b) => b.pfad);

  // Erst die Dateien, dann die Zeile: andersherum wären die Pfade weg und die
  // Bilder blieben als Karteileichen im Storage liegen.
  const admin = adminOderFehler();
  if (!('fehler' in admin)) await bilderEntfernen(admin.admin, pfade);

  const { error } = await supabase.from('erfassung_artikel').delete().eq('id', params.id).eq('status', 'offen');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
