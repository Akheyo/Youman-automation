/** Stripe server client. Throws only when actually used without a key. */

import Stripe from 'stripe';

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY fehlt.');
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cached;
}

/** Public base URL for Stripe redirects. */
export function siteUrl(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin ||
    'http://localhost:3000'
  );
}
