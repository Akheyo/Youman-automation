/**
 * Kueche nimmt die Bestellung an → Betrag wird eingezogen.
 *
 * POST /api/bestellung/<id>/annehmen
 * Kopfzeile: `x-kueche-token: <KUECHEN_TOKEN>`
 *
 * Bis hierhin war der Betrag nur reserviert. Erst dieser Aufruf bucht ihn ab.
 * Wer bestellt hat und keine Annahme bekommt, zahlt also nichts.
 *
 * Achtung Fristen: Kartenreservierungen verfallen nach einigen Tagen — fuer
 * einen Lieferdienst unkritisch, aber eine Bestellung darf nicht ueber Nacht
 * unbeantwortet liegen bleiben. Der Aufraeumlauf in der Verwaltung gibt
 * Reservierungen frei, die nach Ladenschluss niemand angefasst hat.
 */

import { NextResponse } from 'next/server';
import { getStripe, stripeKonfiguriert } from '@/lib/stripe';
import { db, dbKonfiguriert, kuechenSchluesselGueltig } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!kuechenSchluesselGueltig(request.headers.get('x-kueche-token'))) {
    return NextResponse.json({ fehler: 'Nicht berechtigt.' }, { status: 401 });
  }
  if (!stripeKonfiguriert() || !dbKonfiguriert()) {
    return NextResponse.json({ fehler: 'Nicht konfiguriert.' }, { status: 503 });
  }

  const sql = db();
  const { data: bestellung } = await sql
    .from('bestellungen')
    .select('id, status, stripe_payment_intent_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!bestellung) return NextResponse.json({ fehler: 'Bestellung nicht gefunden.' }, { status: 404 });
  if (bestellung.status === 'angenommen') return NextResponse.json({ status: 'angenommen' }); // Doppelklick
  if (bestellung.status !== 'autorisiert') {
    return NextResponse.json({ fehler: `Bestellung ist im Status „${bestellung.status}".` }, { status: 409 });
  }
  if (!bestellung.stripe_payment_intent_id) {
    return NextResponse.json({ fehler: 'Zu dieser Bestellung gibt es keine Zahlung.' }, { status: 409 });
  }

  try {
    await getStripe().paymentIntents.capture(bestellung.stripe_payment_intent_id, undefined, {
      idempotencyKey: `capture-${bestellung.id}`,
    });
  } catch (err) {
    return NextResponse.json(
      { fehler: `Zahlung konnte nicht gebucht werden: ${err instanceof Error ? err.message : err}` },
      { status: 502 },
    );
  }

  await sql
    .from('bestellungen')
    .update({ status: 'angenommen', angenommen_am: new Date().toISOString() })
    .eq('id', bestellung.id);

  return NextResponse.json({ status: 'angenommen' });
}
