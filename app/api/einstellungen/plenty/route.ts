/**
 * Einstellungen des PlentyONE-Zugangs.
 *
 *   GET    → aktueller Stand (Passwort nur maskiert)
 *   PUT    → speichern
 *   POST   → Verbindung testen, auch mit noch nicht gespeicherten Eingaben
 *   DELETE → gespeicherten Zugang verwerfen, Umgebungsvariablen gelten wieder
 *
 * DAS PASSWORT WIRD NIE AUSGELIEFERT. Der GET gibt nur zurück, ob eines
 * hinterlegt ist und wie seine letzten Zeichen lauten — genug, um es
 * wiederzuerkennen, zu wenig, um damit etwas anzufangen.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { testPlentyConnection } from '@/lib/plenty/client';
import {
  ladeZugang,
  normalisiereBaseUrl,
  pruefeTabelle,
  speichereZugang,
  verwerfeZugang,
} from '@/lib/einstellungen/plenty';
import { maskiere, schluesselQuelle } from '@/lib/einstellungen/tresor';
import { supabaseInfo } from '@/lib/einstellungen/supabase-info';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Nur angemeldete Nutzer. Gibt die E-Mail zurück, um Änderungen zuzuordnen. */
async function angemeldet(): Promise<{ ok: true; email: string | null } | { ok: false }> {
  const supabase = createClient();
  // Ohne Supabase läuft die App im offenen Modus (siehe README) — dann gibt es
  // keine Anmeldung, die man prüfen könnte.
  if (!supabase) return { ok: true, email: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { ok: true, email: user.email ?? null } : { ok: false };
}

/**
 * Muss eine FUNKTION sein, keine Konstante: Der Body einer Response ist ein
 * Stream, der sich nur einmal lesen laesst. Ein wiederverwendetes Objekt
 * liefert ab dem zweiten Mal eine leere Antwort — der Aufrufer saehe dann nur
 * ein nacktes 401 ohne Begruendung.
 */
const nichtAngemeldet = () => NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

export async function GET() {
  const wer = await angemeldet();
  if (!wer.ok) return nichtAngemeldet();

  const [zugang, tabelle] = await Promise.all([ladeZugang({ frisch: true }), pruefeTabelle()]);
  return NextResponse.json({
    baseUrl: zugang.baseUrl,
    user: zugang.user,
    // Nie das Passwort selbst — nur ob und wie es endet.
    passwortGesetzt: Boolean(zugang.password),
    passwortMaske: maskiere(zugang.password),
    passwortUnlesbar: zugang.passwortUnlesbar,
    plentyId: zugang.plentyId,
    warehouseId: zugang.warehouseId,
    quelle: zugang.quelle,
    geaendertVon: zugang.geaendertVon,
    geaendertAm: zugang.geaendertAm,
    schluessel: schluesselQuelle(),
    // An welchem Supabase-Projekt diese Installation haengt — damit klar ist,
    // wo das Schema eingespielt gehoert, wenn mehrere Projekte im Spiel sind.
    supabase: { ...supabaseInfo(), tabelle },
  });
}

export async function PUT(request: Request) {
  const wer = await angemeldet();
  if (!wer.ok) return nichtAngemeldet();

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const text = (wert: unknown) => (typeof wert === 'string' ? wert.trim() : '');
  const baseUrl = normalisiereBaseUrl(text(body.baseUrl));
  const user = text(body.user);
  const passwort = typeof body.passwort === 'string' ? body.passwort : '';

  if (!baseUrl || !user) {
    return NextResponse.json({ error: 'Basis-URL und Benutzername sind Pflichtfelder.' }, { status: 400 });
  }
  if (!/^https:\/\//i.test(baseUrl)) {
    // Ohne HTTPS ginge das Passwort im Klartext über die Leitung.
    return NextResponse.json({ error: 'Die Basis-URL muss mit https:// beginnen.' }, { status: 400 });
  }

  // Beim ersten Speichern muss ein Passwort dabei sein; danach darf das Feld
  // leer bleiben und das gespeicherte gilt weiter.
  const bisher = await ladeZugang({ frisch: true });
  if (!passwort && !bisher.password) {
    return NextResponse.json({ error: 'Beim ersten Speichern wird das Passwort gebraucht.' }, { status: 400 });
  }

  const zahl = (wert: unknown): number | null => {
    if (wert === null || wert === '' || wert === undefined) return null;
    const n = Number(wert);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  const ergebnis = await speichereZugang({
    baseUrl,
    user,
    passwort: passwort || undefined,
    plentyId: zahl(body.plentyId),
    warehouseId: zahl(body.warehouseId),
    von: wer.email,
  });

  if (!ergebnis.ok) return NextResponse.json({ error: ergebnis.fehler }, { status: 500 });

  // Gleich mitprüfen, ob der frisch gespeicherte Zugang auch trägt.
  const test = await testPlentyConnection();
  return NextResponse.json({ ok: true, test });
}

export async function POST(request: Request) {
  const wer = await angemeldet();
  if (!wer.ok) return nichtAngemeldet();

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Ohne Body wird der gespeicherte Zugang getestet.
  }

  const text = (wert: unknown) => (typeof wert === 'string' ? wert.trim() : undefined);
  const baseUrl = text(body.baseUrl);
  const user = text(body.user);
  const passwort = typeof body.passwort === 'string' && body.passwort ? body.passwort : undefined;

  const test = await testPlentyConnection(
    baseUrl || user || passwort
      ? {
          ...(baseUrl ? { baseUrl: normalisiereBaseUrl(baseUrl) } : {}),
          ...(user ? { user } : {}),
          ...(passwort ? { password: passwort } : {}),
        }
      : undefined,
  );
  return NextResponse.json(test, { status: test.ok ? 200 : 502 });
}

export async function DELETE() {
  const wer = await angemeldet();
  if (!wer.ok) return nichtAngemeldet();
  const ergebnis = await verwerfeZugang();
  return ergebnis.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: ergebnis.fehler }, { status: 500 });
}
