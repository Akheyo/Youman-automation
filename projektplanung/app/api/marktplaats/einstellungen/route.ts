/**
 * GET  → der hinterlegte Marktplaats-Zugang, ohne das Secret.
 * POST → speichert ihn.
 *
 * Das Client-Secret verlässt den Server nie. Die Seite sieht nur, ob eines
 * hinterlegt ist — wie beim Plenty-Passwort.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ladeZugang, speichereZugang, UMGEBUNGEN, type Umgebung } from '@/lib/einstellungen/marktplaats';
import { vergissToken } from '@/lib/marktplaats/client';

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

  const z = await ladeZugang({ frisch: true });
  return NextResponse.json({
    clientId: z.clientId,
    // Nur die Endung, wie beim Plenty-Passwort: genug, um zu erkennen, welches
    // Secret hinterlegt ist, ohne es preiszugeben.
    secretHinweis: z.clientSecret ? `••••••${z.clientSecret.slice(-4)}` : null,
    secretUnlesbar: z.secretUnlesbar,
    umgebung: z.umgebung,
    apiUrl: z.apiUrl,
    authUrl: z.authUrl,
    postleitzahl: z.postleitzahl,
    versandEuro: z.versandEuro,
    quelle: z.quelle,
    geaendertVon: z.geaendertVon,
    geaendertAm: z.geaendertAm,
    vorgaben: UMGEBUNGEN,
  });
}

export async function POST(request: Request) {
  const { ok, email } = await nutzer();
  if (!ok) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    clientId?: string;
    clientSecret?: string;
    umgebung?: Umgebung;
    apiUrl?: string;
    postleitzahl?: string;
    versandEuro?: number | null;
  };

  const ergebnis = await speichereZugang({
    clientId: body.clientId,
    // Leer heißt „unverändert" — man soll die PLZ ändern können, ohne das
    // Secret erneut einzutippen.
    clientSecret: body.clientSecret ? body.clientSecret : undefined,
    umgebung: body.umgebung,
    apiUrl: body.apiUrl,
    postleitzahl: body.postleitzahl,
    versandEuro: body.versandEuro,
    von: email,
  });
  vergissToken();

  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 400 });
}
