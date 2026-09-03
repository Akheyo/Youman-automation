/**
 * Stripe-Webhook — die einzige Stelle, an der eine Bestellung als bezahlt gilt.
 *
 * Niemals die Erfolgsseite dafuer verwenden: der Gast kann den Browser
 * schliessen, bevor sie laedt, und die URL laesst sich aufrufen, ohne bezahlt
 * zu haben. Was zaehlt, ist das signierte Ereignis von Stripe.
 *
 * Einrichten: Stripe → Entwickler → Webhooks → Endpunkt `/api/stripe/webhook`
 * mit den Ereignissen `checkout.session.completed`, `checkout.session.expired`
 * und `charge.refunded`.
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, stripeKonfiguriert } from '@/lib/stripe';
import { db, dbKonfiguriert } from '@/lib/db';
import { meldeAnKueche } from '@/lib/kueche';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKonfiguriert() || !secret || !dbKonfiguriert()) {
    return NextResponse.json({ fehler: 'Webhook nicht konfiguriert.' }, { status: 503 });
  }

  const stripe = getStripe();
  const signatur = request.headers.get('stripe-signature') || '';
  // Rohtext, nicht geparst — sonst stimmt die Signatur nicht.
  const roh = await request.text();

  let ereignis: Stripe.Event;
  try {
    ereignis = stripe.webhooks.constructEvent(roh, signatur, secret);
  } catch (err) {
    return NextResponse.json({ fehler: `Signatur ungültig: ${err instanceof Error ? err.message : err}` }, { status: 400 });
  }

  const sql = db();

  switch (ereignis.type) {
    case 'checkout.session.completed': {
      const session = ereignis.data.object as Stripe.Checkout.Session;
      const id = session.metadata?.bestellung_id;
      if (!id) break;

      // Idempotent: Stripe stellt dasselbe Ereignis mehrfach zu. Nur eine
      // Bestellung, die noch `offen` ist, wird weitergeschaltet — sonst
      // landet derselbe Bon zweimal in der Kueche.
      const { data: aktualisiert } = await sql
        .from('bestellungen')
        .update({
          status: 'autorisiert',
          bezahlt_am: new Date().toISOString(),
          stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        })
        .eq('id', id)
        .eq('status', 'offen')
        .select('id, nummer, abholart, name, telefon, strasse, plz, ort, hinweis, summe')
        .maybeSingle();

      if (!aktualisiert) break; // schon verarbeitet

      const { data: posten } = await sql
        .from('bestell_posten')
        .select('menge, bezeichnung')
        .eq('bestellung_id', id);

      const zugestellt = await meldeAnKueche({
        bestellungId: aktualisiert.id,
        nummer: aktualisiert.nummer,
        abholart: aktualisiert.abholart,
        name: aktualisiert.name,
        telefon: aktualisiert.telefon,
        adresse: aktualisiert.strasse ? `${aktualisiert.strasse}, ${aktualisiert.plz} ${aktualisiert.ort}` : null,
        hinweis: aktualisiert.hinweis,
        summe: aktualisiert.summe,
        posten: posten ?? [],
      });

      if (!zugestellt) {
        // Sichtbar machen statt verschlucken — die Verwaltung hebt solche
        // Bestellungen hervor, damit niemand unbemerkt wartet.
        await sql.from('bestellungen').update({ hinweis_intern: 'Küchenmeldung fehlgeschlagen' }).eq('id', id);
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = ereignis.data.object as Stripe.Checkout.Session;
      const id = session.metadata?.bestellung_id;
      if (id) await sql.from('bestellungen').update({ status: 'verfallen' }).eq('id', id).eq('status', 'offen');
      break;
    }

    case 'charge.refunded': {
      const charge = ereignis.data.object as Stripe.Charge;
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
      if (!pi) break;
      await sql
        .from('bestellungen')
        .update({
          erstattet: charge.amount_refunded,
          status: charge.amount_refunded >= charge.amount ? 'erstattet' : 'angenommen',
        })
        .eq('stripe_payment_intent_id', pi);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ empfangen: true });
}
