/**
 * Opens the Stripe Customer Portal so a subscriber can manage / cancel their
 * plan and payment method. Returns { url }.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured, siteUrl } from '@/lib/stripe';

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

  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  const customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) return NextResponse.json({ error: 'Kein Abo vorhanden.' }, { status: 400 });

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl(request)}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
