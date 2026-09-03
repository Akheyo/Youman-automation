/**
 * Kueche lehnt ab oder storniert → Reservierung frei bzw. Geld zurueck.
 *
 * POST /api/bestellung/<id>/ablehnen
 * Kopfzeile: `x-kueche-token: <KUECHEN_TOKEN>`
 * Rumpf (optional): { "betrag": 750, "grund": "Thunfisch aus" }
 *
 * Zwei Faelle, die der Aufruf selbst unterscheidet:
 *
 *   Status `autorisiert` → noch nichts eingezogen. Die Reservierung wird
 *   freigegeben. Dem Gast wird nichts belastet, es gibt keine Gutschrift auf
 *   der Abrechnung und keine Rueckfrage bei der Bank. Sauberster Fall.
 *
 *   Status `angenommen` → schon gebucht. Dann Erstattung, ganz oder in Hoehe
 *   von `betrag` (etwa wenn eine Beilage ausgegangen ist und der Rest kommt).
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

  const rumpf = (await request.json().catch(() => ({}))) as { betrag?: number; grund?: string };
  const sql = db();

  const { data: bestellung } = await sql
    .from('bestellungen')
    .select('id, status, summe, erstattet, stripe_payment_intent_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!bestellung) return NextResponse.json({ fehler: 'Bestellung nicht gefunden.' }, { status: 404 });
  if (!bestellung.stripe_payment_intent_id) {
    return NextResponse.json({ fehler: 'Zu dieser Bestellung gibt es keine Zahlung.' }, { status: 409 });
  }

  const stripe = getStripe();
  const grund = rumpf.grund?.trim()?.slice(0, 200) || null;

  // Fall 1 — noch nicht gebucht: Reservierung freigeben, es fliesst kein Geld.
  if (bestellung.status === 'autorisiert') {
    try {
      await stripe.paymentIntents.cancel(bestellung.stripe_payment_intent_id, {
        cancellation_reason: 'abandoned',
      });
    } catch (err) {
      return NextResponse.json(
        { fehler: `Reservierung konnte nicht freigegeben werden: ${err instanceof Error ? err.message : err}` },
        { status: 502 },
      );
    }
    await sql
      .from('bestellungen')
      .update({ status: 'abgelehnt', abgeschlossen_am: new Date().toISOString(), hinweis_intern: grund })
      .eq('id', bestellung.id);
    return NextResponse.json({ status: 'abgelehnt', erstattet: 0 });
  }

  // Fall 2 — bereits gebucht: erstatten.
  if (bestellung.status === 'angenommen' || bestellung.status === 'erstattet') {
    const offen = bestellung.summe - bestellung.erstattet;
    if (offen <= 0) return NextResponse.json({ fehler: 'Bereits vollständig erstattet.' }, { status: 409 });

    const betrag = rumpf.betrag ? Math.min(Math.round(rumpf.betrag), offen) : offen;
    if (betrag <= 0) return NextResponse.json({ fehler: 'Ungültiger Erstattungsbetrag.' }, { status: 400 });

    try {
      await stripe.refunds.create(
        { payment_intent: bestellung.stripe_payment_intent_id, amount: betrag },
        // Teilerstattungen duerfen sich unterscheiden, deshalb Betrag im Schluessel.
        { idempotencyKey: `refund-${bestellung.id}-${bestellung.erstattet}-${betrag}` },
      );
    } catch (err) {
      return NextResponse.json(
        { fehler: `Erstattung fehlgeschlagen: ${err instanceof Error ? err.message : err}` },
        { status: 502 },
      );
    }

    // Den Endstand setzt der `charge.refunded`-Webhook — er ist die Quelle,
    // die auch Erstattungen aus dem Stripe-Dashboard mitbekommt.
    if (grund) await sql.from('bestellungen').update({ hinweis_intern: grund }).eq('id', bestellung.id);
    return NextResponse.json({ status: 'erstattet', erstattet: betrag });
  }

  return NextResponse.json({ fehler: `Bestellung ist im Status „${bestellung.status}".` }, { status: 409 });
}
