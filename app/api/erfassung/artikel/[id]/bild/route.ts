/**
 * Fotos eines Artikels.
 *
 * POST   → Platz reservieren und eine Upload-Erlaubnis ausgeben. Der Browser
 *          lädt danach DIREKT zum Storage (siehe lib/erfassung/speicher.ts).
 * PUT    → Der Browser bestätigt, dass der Upload durch ist. Erst dann zählt
 *          das Bild. Ohne diese Bestätigung fiele ein abgebrochener Upload
 *          niemandem auf — der Fehler, den die alte WhatsApp-Strecke hatte.
 * DELETE → Foto verwerfen (neu machen).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminOderFehler, bilderEntfernen, uploadErlaubnis } from '@/lib/erfassung/speicher';
import { bildPfad, dateiEndung, istRolle, naechstePosition, validiereBild } from '@/lib/erfassung/logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/** Meldet den angemeldeten Nutzer oder eine fertige Fehlerantwort. */
async function nutzer() {
  const supabase = createClient();
  if (!supabase) {
    return { antwort: NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 }) };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { antwort: NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 }) };
  return { supabase, user };
}

export async function POST(request: Request, { params }: Params) {
  const auth = await nutzer();
  if (auth.antwort) return auth.antwort;
  const { supabase, user } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    rolle?: string;
    dateiname?: string;
    contentType?: string;
    groesse?: number;
  };

  const rolle = istRolle(body.rolle) ? body.rolle : 'detail';
  const fehler = validiereBild({ contentType: body.contentType, groesse: body.groesse });
  if (fehler) return NextResponse.json({ error: fehler }, { status: 400 });

  // Der Artikel muss existieren und darf noch offen sein — an einem
  // abgeschickten Artikel nachträglich Bilder anzuhängen wäre still und
  // würde die Verarbeitung mit halbem Bildsatz laufen lassen.
  const { data: artikel, error: ladeFehler } = await supabase
    .from('erfassung_artikel')
    .select('id, status')
    .eq('id', params.id)
    .single();
  if (ladeFehler || !artikel) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });
  if (artikel.status !== 'offen') {
    return NextResponse.json({ error: 'Der Artikel ist bereits abgeschickt.' }, { status: 409 });
  }

  const { data: vorhandene } = await supabase
    .from('erfassung_bilder')
    .select('position')
    .eq('artikel_id', params.id);

  const position = naechstePosition(vorhandene ?? []);
  const pfad = bildPfad(params.id, position, rolle, dateiEndung(body.dateiname, body.contentType));

  const admin = adminOderFehler();
  if ('fehler' in admin) return NextResponse.json({ error: admin.fehler }, { status: 503 });

  const erlaubnis = await uploadErlaubnis(admin.admin, pfad);
  if ('fehler' in erlaubnis) return NextResponse.json({ error: erlaubnis.fehler }, { status: 502 });

  const { data: bild, error: insertFehler } = await supabase
    .from('erfassung_bilder')
    .insert({
      artikel_id: params.id,
      user_id: user.id,
      rolle,
      position,
      pfad,
      dateiname: body.dateiname ?? null,
      bytes: body.groesse ?? null,
      hochgeladen: false,
    })
    .select('id, rolle, position, pfad, hochgeladen')
    .single();

  if (insertFehler || !bild) {
    return NextResponse.json({ error: insertFehler?.message ?? 'Speichern fehlgeschlagen.' }, { status: 400 });
  }

  return NextResponse.json({ bild, upload: { pfad, token: erlaubnis.token } });
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await nutzer();
  if (auth.antwort) return auth.antwort;
  const { supabase } = auth;

  const { bildId } = (await request.json().catch(() => ({}))) as { bildId?: string };
  if (!bildId) return NextResponse.json({ error: 'bildId fehlt.' }, { status: 400 });

  const { data, error } = await supabase
    .from('erfassung_bilder')
    .update({ hochgeladen: true })
    .eq('id', bildId)
    .eq('artikel_id', params.id)
    .select('id, rolle, position, pfad, hochgeladen')
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Bild nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ bild: data });
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await nutzer();
  if (auth.antwort) return auth.antwort;
  const { supabase } = auth;

  const { bildId } = (await request.json().catch(() => ({}))) as { bildId?: string };
  if (!bildId) return NextResponse.json({ error: 'bildId fehlt.' }, { status: 400 });

  const { data, error } = await supabase
    .from('erfassung_bilder')
    .delete()
    .eq('id', bildId)
    .eq('artikel_id', params.id)
    .select('pfad')
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Bild nicht gefunden.' }, { status: 404 });

  const admin = adminOderFehler();
  if (!('fehler' in admin)) await bilderEntfernen(admin.admin, [data.pfad]);

  return NextResponse.json({ ok: true });
}
