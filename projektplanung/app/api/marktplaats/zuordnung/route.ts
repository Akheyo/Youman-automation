/**
 * Die Zuordnung „Plenty-Sortiment → Marktplaats-Kategorie".
 *
 * GET    → alle gepflegten Zeilen.
 * POST   → eine Zeile eintragen oder ändern.
 * DELETE → eine Zeile entfernen.
 *
 * Was hier fehlt, wird beim Abgleich NICHT geraten: Der Artikel bleibt liegen
 * und wird gezählt. Eine Anzeige in der falschen Rubrik fällt niemandem auf.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ladeZuordnung, loescheZuordnung, speichereZuordnung } from '@/lib/marktplaats/kategorien';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function nutzer(): Promise<{ ok: boolean; email: string | null }> {
  const supabase = createClient();
  if (!supabase) return { ok: true, email: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { ok: Boolean(user), email: user?.email ?? null };
}

export async function GET() {
  const { ok } = await nutzer();
  if (!ok) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  const map = await ladeZuordnung();
  return NextResponse.json({ zeilen: [...map.values()].sort((a, b) => a.stichwort.localeCompare(b.stichwort)) });
}

export async function POST(request: Request) {
  const { ok, email } = await nutzer();
  if (!ok) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    stichwort?: string;
    kategorieId?: number;
    kategorieName?: string | null;
  };

  const ergebnis = await speichereZuordnung(body.stichwort ?? '', Number(body.kategorieId), {
    kategorieName: body.kategorieName ?? null,
    von: email,
  });
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 400 });
}

export async function DELETE(request: Request) {
  const { ok } = await nutzer();
  if (!ok) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  const stichwort = new URL(request.url).searchParams.get('stichwort') ?? '';
  const geloescht = await loescheZuordnung(stichwort);
  return NextResponse.json({ ok: geloescht }, { status: geloescht ? 200 : 400 });
}
