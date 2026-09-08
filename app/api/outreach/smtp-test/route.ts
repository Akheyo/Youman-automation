/**
 * POST → prüft die SMTP-Zugangsdaten, ohne eine Mail zu verschicken.
 *
 * Gedacht für den Systemcheck beim Einrichten: stimmen Host, Port, Benutzer
 * und Passwort? Der häufigste Fehler ist ein normales Kontopasswort statt
 * eines App-Passworts — das meldet der Server als "invalid login", was hier
 * in einen brauchbaren Satz übersetzt wird.
 *
 * Nur für Inhaber, da die Antwort Rückschlüsse auf die Serverkonfiguration
 * zulässt. Zugangsdaten selbst werden nie zurückgegeben.
 */

import { NextResponse } from 'next/server';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { isOwnerEmail } from '@/lib/plans';
import { smtpSettings, verifySmtp } from '@/lib/outreach/smtp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (supabaseConfigured()) {
    const supabase = createClient()!;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
    if (!isOwnerEmail(user.email)) return NextResponse.json({ error: 'Nur für Inhaber.' }, { status: 403 });
  }

  const settings = smtpSettings();
  if (!settings) {
    return NextResponse.json({ ok: false, error: 'SMTP ist nicht eingerichtet (SMTP_HOST, SMTP_USER und SMTP_PASS fehlen).' });
  }

  const res = await verifySmtp(settings);
  if (res.ok) return NextResponse.json({ ok: true, host: settings.host, port: settings.port, secure: settings.secure });
  return NextResponse.json({ ok: false, error: res.error });
}
