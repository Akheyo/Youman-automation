/**
 * Stripe webhook. Keeps each profile's plan/subscription in sync with Stripe.
 * Configure in Stripe → Developers → Webhooks → endpoint `/api/stripe/webhook`,
 * events: checkout.session.completed, customer.subscription.*.
 *
 * Uses the service-role Supabase client (no user session in a webhook).
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, stripeConfigured } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { planByPriceId } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) {
    return NextResponse.json({ error: 'Stripe-Webhook nicht konfiguriert.' }, { status: 503 });
  }

  const stripe = getStripe();
  const sig = request.headers.get('stripe-signature') || '';
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Signatur ungültig: ${err instanceof Error ? err.message : err}` }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase-Admin nicht konfiguriert.' }, { status: 503 });

  async function syncSubscription(sub: Stripe.Subscription) {
    const item = sub.items.data[0];
    const priceId = item?.price?.id;
    const plan = planByPriceId(priceId);
    const userId = (sub.metadata?.supabase_user_id as string | undefined) || null;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const active = sub.status === 'active' || sub.status === 'trialing';
    const periodEnd = item?.current_period_end;

    const update = {
      plan: active ? plan : 'free',
      subscription_status: sub.status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    };

    if (userId) {
      await admin!.from('profiles').update(update).eq('id', userId);
    } else {
      await admin!.from('profiles').update(update).eq('stripe_customer_id', customerId);
    }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
