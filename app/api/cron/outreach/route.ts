/**
 * Versand-Scheduler für Pauls Outreach-Kampagnen.
 *
 * Gedacht für einen Aufruf im Minutenraster (Vercel Cron oder ein beliebiger
 * externer Scheduler). Pro aktiver Kampagne gilt:
 *   - nur innerhalb des Versandfensters (Wochenende optional),
 *   - Tageslimit der Kampagne, über die Fensterstunden verteilt,
 *   - Monatskontingent des Tarifs (Owner unbegrenzt),
 *   - je Kontakt der nächste fällige Schritt der Sequenz.
 *
 * Auth: ist CRON_SECRET gesetzt, muss `Authorization: Bearer <secret>` kommen.
 * Vercel Cron setzt den Header automatisch, sobald die Variable existiert.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { outreachConfigured } from '@/lib/outreach/sender';
import { runOutreachQueue } from '@/lib/outreach/queue';
import { planForUser, isOwnerEmail } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Obergrenze pro Aufruf, damit ein Lauf in die Cron-Laufzeit passt.
const GLOBAL_CAP = 40;

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
  if (!outreachConfigured()) return NextResponse.json({ ok: true, sent: 0, skipped: 'versand-nicht-konfiguriert' });

  // Tarif je Absender einmal laden, statt pro Mail.
  const cache = new Map<string, { unlimited: boolean; limit: number }>();
  async function consumeQuota(userId: string): Promise<boolean> {
    let entry = cache.get(userId);
    if (!entry) {
      const { data: profile } = await admin!.from('profiles').select('plan, email').eq('id', userId).single();
      const plan = planForUser({ plan: profile?.plan, email: profile?.email });
      entry = { unlimited: isOwnerEmail(profile?.email), limit: plan.emails };
      cache.set(userId, entry);
    }
    if (entry.unlimited) return true;
    const { data, error } = await admin!.rpc('consume_email_quota_for', { p_user: userId, p_limit: entry.limit });
    // Fehlt die Funktion (Schema noch nicht eingespielt), wird nicht hart geblockt.
    if (error) return true;
    return data === true;
  }

  const { sent, report } = await runOutreachQueue(admin, { globalCap: GLOBAL_CAP, consumeQuota });
  return NextResponse.json({ ok: true, sent, report });
}
