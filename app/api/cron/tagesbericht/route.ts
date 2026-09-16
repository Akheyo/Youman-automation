/**
 * Tagesbericht — einmal am Abend je Konto eine Mail mit dem Tag.
 *
 * Läuft per Cron (Vercel: 16:00 UTC, also 18 Uhr Sommer- / 17 Uhr Winterzeit)
 * oder von Hand. Für jedes Konto mit eingeschaltetem Bericht und mindestens
 * einer Kampagne, die nicht mehr Entwurf ist:
 *   - Ereignisse der letzten 24 Stunden je Kampagne einsammeln,
 *   - zu Öffnungen, Antworten und Abmeldungen die Kontakte namentlich holen,
 *   - Bericht bauen und über das eigene Postfach an die Kontoadresse senden.
 *
 * Schweigt, wenn nichts passiert ist — ein leerer Bericht ist Lärm.
 *
 * Auth: ist CRON_SECRET gesetzt, muss `Authorization: Bearer <secret>` kommen.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { baueBericht, hatInhalt, type BerichtKampagne, type BerichtKontakt } from '@/lib/outreach/tagesbericht';
import { mailboxes, warmupConfig, poolKapazitaet, type MailboxAuslastung } from '@/lib/outreach/mailboxes';
import { smtpSettings, sendViaSmtp, smtpFrom } from '@/lib/outreach/smtp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FENSTER_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase Service-Role nicht konfiguriert.' }, { status: 503 });

  const settings = smtpSettings();
  if (!settings) return NextResponse.json({ ok: true, gesendet: 0, skipped: 'smtp-nicht-konfiguriert' });

  const jetzt = new Date();
  const seit = new Date(jetzt.getTime() - FENSTER_MS).toISOString();
  const startOfDay = new Date(jetzt);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const cockpitUrl = (process.env.APP_URL || '').replace(/\/$/, '') + '/outreach';

  // Konten mit Bericht und mindestens einer Kampagne jenseits des Entwurfs.
  const { data: kampagnen } = await admin
    .from('outreach_campaigns')
    .select('id, user_id, name, status, paused_reason')
    .neq('status', 'entwurf');
  const proUser = new Map<string, typeof kampagnen>();
  for (const k of kampagnen ?? []) {
    const arr = proUser.get(k.user_id) ?? [];
    arr.push(k);
    proUser.set(k.user_id, arr);
  }

  // Postfach-Kapazität einmal je Lauf (gilt kontoübergreifend, da aus der Umgebung).
  let kapazitaet: { erlaubt: number; verbraucht: number } | null = null;
  const pool = mailboxes();
  if (pool.length > 0) {
    const auslastung: Record<string, MailboxAuslastung> = {};
    for (const mb of pool) {
      const { count } = await admin
        .from('outreach_events')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'gesendet')
        .eq('mailbox', mb.id)
        .gte('created_at', startOfDay.toISOString());
      const { data: erste } = await admin
        .from('outreach_events')
        .select('created_at')
        .eq('kind', 'gesendet')
        .eq('mailbox', mb.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      auslastung[mb.id] = { heute: count ?? 0, ersterVersand: erste?.created_at ?? null };
    }
    kapazitaet = poolKapazitaet(pool, auslastung, warmupConfig(), jetzt);
  }

  let gesendet = 0;
  const report: Record<string, unknown>[] = [];

  for (const [userId, liste] of proUser) {
    const { data: profil } = await admin.from('profiles').select('email, tagesbericht').eq('id', userId).single();
    if (!profil?.email || profil.tagesbericht === false) {
      report.push({ user: userId, skip: 'aus-oder-keine-adresse' });
      continue;
    }

    const berichtKampagnen: BerichtKampagne[] = [];
    for (const k of liste ?? []) {
      const { data: events } = await admin
        .from('outreach_events')
        .select('kind, step_no, contact_id, created_at')
        .eq('campaign_id', k.id)
        .gte('created_at', seit)
        .order('created_at', { ascending: false });

      const zaehl = { gesendet: 0, fehler: 0, bounces: 0 };
      // Je Kontakt nur das jüngste Ereignis einer Art — wer dreimal öffnet,
      // steht einmal in der Liste, mit Zähler.
      const geoeffnet = new Map<string, { step_no: number | null; created_at: string }>();
      const geantwortet = new Map<string, { step_no: number | null; created_at: string }>();
      const abgemeldet = new Map<string, { step_no: number | null; created_at: string }>();
      for (const e of events ?? []) {
        if (e.kind === 'gesendet') zaehl.gesendet += 1;
        else if (e.kind === 'fehler') zaehl.fehler += 1;
        else if (e.kind === 'bounce') zaehl.bounces += 1;
        else if (e.kind === 'geoeffnet' && e.contact_id && !geoeffnet.has(e.contact_id)) geoeffnet.set(e.contact_id, e);
        else if (e.kind === 'geantwortet' && e.contact_id && !geantwortet.has(e.contact_id)) geantwortet.set(e.contact_id, e);
        else if (e.kind === 'abgemeldet' && e.contact_id && !abgemeldet.has(e.contact_id)) abgemeldet.set(e.contact_id, e);
      }

      const ids = [...new Set([...geoeffnet.keys(), ...geantwortet.keys(), ...abgemeldet.keys()])];
      const kontakte = new Map<string, { first_name: string | null; last_name: string | null; company: string | null; email: string; opens: number }>();
      if (ids.length) {
        const { data } = await admin
          .from('outreach_contacts')
          .select('id, first_name, last_name, company, email, opens')
          .in('id', ids);
        for (const c of data ?? []) kontakte.set(c.id, c);
      }
      const alsKontakt = (id: string, e: { step_no: number | null; created_at: string }, mitAnzahl: boolean): BerichtKontakt | null => {
        const c = kontakte.get(id);
        if (!c) return null;
        return {
          vorname: c.first_name,
          nachname: c.last_name,
          firma: c.company,
          email: c.email,
          schritt: e.step_no,
          zeitpunkt: e.created_at,
          anzahl: mitAnzahl ? c.opens : undefined,
        };
      };

      const { count: offen } = await admin
        .from('outreach_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', k.id)
        .in('status', ['neu', 'aktiv']);

      berichtKampagnen.push({
        name: k.name,
        status: k.status,
        paused_reason: k.paused_reason,
        gesendet: zaehl.gesendet,
        fehler: zaehl.fehler,
        bounces: zaehl.bounces,
        offen: offen ?? 0,
        geoeffnet: [...geoeffnet].map(([id, e]) => alsKontakt(id, e, true)).filter((x): x is BerichtKontakt => x !== null),
        geantwortet: [...geantwortet].map(([id, e]) => alsKontakt(id, e, false)).filter((x): x is BerichtKontakt => x !== null),
        abgemeldet: [...abgemeldet].map(([id, e]) => alsKontakt(id, e, false)).filter((x): x is BerichtKontakt => x !== null),
      });
    }

    const daten = { datum: jetzt, empfaenger: profil.email, kampagnen: berichtKampagnen, kapazitaet, cockpitUrl };
    if (!hatInhalt(daten)) {
      report.push({ user: userId, skip: 'nichts-passiert' });
      continue;
    }

    const b = baueBericht(daten);
    const res = await sendViaSmtp(
      { to: profil.email, subject: b.subject, text: b.text, html: b.html, from: smtpFrom() || settings.user },
      settings,
    );
    if (res.ok) gesendet += 1;
    report.push({ user: userId, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
  }

  return NextResponse.json({ ok: true, gesendet, report });
}
