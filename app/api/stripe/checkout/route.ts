/**
 * Creates a Stripe Checkout session for the logged-in user to subscribe to a
 * plan. Body: { plan: 'starter' | 'pro' }. Returns { url } to redirect to.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured, siteUrl } from '@/lib/stripe';
import { PLANS, type PlanId } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Bezahlung ist noch nicht konfiguriert.' }, { status: 503 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte zuerst anmelden.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const planId = body.plan as PlanId;
  const plan = planId && PLANS[planId];
  if (!plan || plan.id === 'free' || !plan.stripePriceId) {
    return NextResponse.json({ error: 'Ungültiger oder nicht konfigurierter Tarif.' }, { status: 400 });
  }

  const stripe = getStripe();

  // Reuse the Stripe customer if we already created one for this profile.
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  let customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const base = siteUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/dashboard?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancel`,
    metadata: { supabase_user_id: user.id, plan: plan.id },
    subscription_data: { metadata: { supabase_user_id: user.id, plan: plan.id } },
  });

  return NextResponse.json({ url: session.url });
}
