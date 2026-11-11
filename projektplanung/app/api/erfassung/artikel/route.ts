/**
 * GET  → Die zuletzt erfassten Artikel mit ihren Bildern (Arbeitsliste).
 * POST → Einen neuen, leeren Artikel anlegen. Passiert in dem Moment, in dem
 *        am Regal "Neuer Artikel" getippt wird — der Artikel existiert also,
 *        bevor das erste Foto da ist. Genau darum kann nichts mehr verloren
 *        gehen: Jedes Foto hat von der ersten Sekunde an einen Besitzer.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminOderFehler, ansichtsLinks } from '@/lib/erfassung/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LISTE_LIMIT = 50;

interface BildZeile {
  id: string;
  rolle: string;
  position: number;
  pfad: string;
  hochgeladen: boolean;
  url?: string | null;
}
interface ArtikelZeile {
  id: string;
  nummer: number;
  status: string;
  bilder: BildZeile[] | null;
}

export async function GET(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const parameter = new URL(request.url).searchParams;
  const status = parameter.get('status');
  const nurEigene = parameter.get('mein') === '1';
  // Erfassung und Fotostudio teilen sich die Tabelle; ohne Angabe sieht jeder
  // Weg nur seine eigenen Artikel.
  const quelle = parameter.get('quelle') === 'fotostudio' ? 'fotostudio' : 'erfassung';

  const abfrage = (mitQuelle: boolean) => {
    // Als string typisiert: Den zusammengesetzten Text will der Typ-Parser von
    // supabase-js sonst bis in die letzte Spalte auflösen und gibt auf.
    const spalten: string = `id, nummer, status, ${mitQuelle ? 'quelle, ' : ''}ean, notiz, erfasst_von, created_at, fertig_am, fehler, plenty_item_id, plenty_variation_id, erkennung, treffer, erkannt_am, erkennung_fehler, zustand, zustand_bestaetigt, gravierende_schaeden, bestand, gewicht_kg, packklasse, preis, preis_am, preis_fehler, listing, listing_am, listing_fehler, plenty, plenty_am, plenty_fehler, bilder:erfassung_bilder (id, rolle, rolle_erkannt, position, pfad, hochgeladen)`;
    let query = supabase
      .from('erfassung_artikel')
      .select(spalten)
      .order('created_at', { ascending: false })
      .limit(LISTE_LIMIT);
    if (mitQuelle) query = query.eq('quelle', quelle);
    if (status) query = query.eq('status', status);
    if (nurEigene) query = query.eq('user_id', user.id);
    return query;
  };

  let { data, error } = await abfrage(true);
  // Spalte "quelle" fehlt, solange schema.sql nicht neu eingespielt ist. Die
  // Erfassung soll daran nicht hängen — vor dem Fotostudio gab es nur sie.
  if (error?.code === '42703' && quelle === 'erfassung') ({ data, error } = await abfrage(false));
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const artikel = (data ?? []) as unknown as ArtikelZeile[];

  // Vorschaulinks nachreichen. Der Bucket ist privat, also braucht jedes Bild
  // einen signierten Link — ohne den bliebe die Kachel grundlos leer, wenn
  // jemand zu einem angefangenen Artikel zurueckkehrt.
  const pfade = artikel.flatMap((a) => (a.bilder ?? []).filter((b) => b.hochgeladen).map((b) => b.pfad));
  const admin = adminOderFehler();
  const links = 'fehler' in admin ? {} : await ansichtsLinks(admin.admin, pfade);
  for (const a of artikel) {
    for (const b of a.bilder ?? []) b.url = links[b.pfad] ?? null;
  }

  return NextResponse.json({ artikel });
}

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { quelle?: string };
  const quelle = body.quelle === 'fotostudio' ? 'fotostudio' : 'erfassung';

  const { data, error } = await supabase
    .from('erfassung_artikel')
    // "quelle" nur fürs Fotostudio mitschicken; die Erfassung nimmt den
    // Spaltenstandard und läuft damit auch vor der Schema-Erweiterung.
    .insert({ user_id: user.id, erfasst_von: user.email ?? null, status: 'offen', ...(quelle === 'fotostudio' ? { quelle } : {}) })
    .select('id, nummer, status, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Anlegen fehlgeschlagen.' }, { status: 400 });
  }
  return NextResponse.json({ artikel: data });
}
